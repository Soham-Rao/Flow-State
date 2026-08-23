import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import { and, count, desc, eq, gt, isNull, ne } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import { invites, passwordResetTokens, roles, userRoleAssignments, users, workspaceMemberships, type RolePermission, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { SecurityRequestContext } from "../../utils/request-context.js";
import { getUserPermissions } from "../../utils/permissions.js";
import { sanitizeOptionalPlainText, sanitizeRequiredPlainText } from "../../utils/sanitize.js";
import { signAccessToken } from "../../utils/jwt.js";
import { getOptionalWorkspaceId, runWithWorkspaceContext } from "../../utils/workspace-context.js";
import { consumeInvite, validateInviteForRegistration } from "../invites/invites.service.js";
import { hashAuditValue, recordAuditLog } from "../security/audit.service.js";
import { getSystemRoleIds, resolveLegacyRole, setUserRoles } from "../roles/roles.service.js";
import { DEFAULT_WORKSPACE_ID } from "../workspaces/workspaces.constants.js";
import { listUserWorkspaces } from "../workspaces/workspaces.service.js";
import type { ForgotPasswordBody, LoginBody, RegisterBody, ResetPasswordBody, UpdateProfileBody } from "./auth.schema.js";

interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  permissions: RolePermission[];
  assignedRoles: Array<{ id: string; name: string; color: string }>;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  dateOfBirth: Date | null;
  createdAt: Date;
  workspaceAssignment?: WorkspaceAssignment;
}

interface WorkspaceAssignment {
  hasEverBeenAssigned: boolean;
  expiresAt: Date | null;
  protectedReason: "configured" | "pending_invite" | null;
  retentionHours: number;
}

interface AuthResponse {
  token: string;
  user: PublicUser;
}

interface GenericActionResponse {
  message: string;
}

type AuditContext = Pick<SecurityRequestContext, "ip" | "userAgent" | "requestId">;

const GENERIC_FORGOT_PASSWORD_MESSAGE = "If an account exists, the password reset request was recorded.";
const GENERIC_RESET_SUCCESS_MESSAGE = "Password reset complete.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildAuditContext(context?: Partial<AuditContext>): AuditContext {
  return {
    ip: context?.ip ?? null,
    userAgent: context?.userAgent ?? null,
    requestId: context?.requestId ?? null
  };
}

async function getAssignedRoles(userId: string, workspaceId: string): Promise<Array<{ id: string; name: string; color: string }>> {
  return db
    .select({
      id: roles.id,
      name: roles.name,
      color: roles.color
    })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(and(eq(userRoleAssignments.workspaceId, workspaceId), eq(userRoleAssignments.userId, userId)));
}

function parseConfiguredSet(value: string, normalize = false): Set<string> {
  return new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => normalize ? entry.toLowerCase() : entry));
}

function isCleanupProtected(userId: string, email: string): boolean {
  return parseConfiguredSet(env.UNASSIGNED_ACCOUNT_PROTECTED_USER_IDS).has(userId)
    || parseConfiguredSet(env.UNASSIGNED_ACCOUNT_PROTECTED_EMAILS, true).has(normalizeEmail(email));
}

async function getWorkspaceAssignment(userId: string, email: string, createdAt: Date): Promise<WorkspaceAssignment> {
  const memberships = await db.select({ userId: workspaceMemberships.userId })
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.userId, userId))
    .limit(1);
  if (memberships.length > 0) {
    return { hasEverBeenAssigned: true, expiresAt: null, protectedReason: null, retentionHours: env.UNASSIGNED_ACCOUNT_RETENTION_HOURS };
  }

  if (isCleanupProtected(userId, email)) {
    return { hasEverBeenAssigned: false, expiresAt: null, protectedReason: "configured", retentionHours: env.UNASSIGNED_ACCOUNT_RETENTION_HOURS };
  }

  const now = new Date();
  const liveInvites = await db.select({ expiresAt: invites.expiresAt })
    .from(invites)
    .where(and(
      eq(invites.email, normalizeEmail(email)),
      isNull(invites.acceptedAt),
      isNull(invites.revokedAt),
      gt(invites.expiresAt, now)
    ))
    .orderBy(desc(invites.expiresAt))
    .limit(1);
  const baseExpiry = new Date(createdAt.getTime() + env.UNASSIGNED_ACCOUNT_RETENTION_HOURS * 60 * 60 * 1000);
  const inviteExpiry = liveInvites[0]?.expiresAt;
  return {
    hasEverBeenAssigned: false,
    expiresAt: inviteExpiry && inviteExpiry > baseExpiry ? inviteExpiry : baseExpiry,
    protectedReason: inviteExpiry && inviteExpiry > baseExpiry ? "pending_invite" : null,
    retentionHours: env.UNASSIGNED_ACCOUNT_RETENTION_HOURS
  };
}

async function toAccountUserWithAssignment(user: Omit<PublicUser, "role" | "permissions" | "assignedRoles" | "workspaceAssignment">): Promise<PublicUser> {
  return {
    ...toAccountUser(user),
    workspaceAssignment: await getWorkspaceAssignment(user.id, user.email, user.createdAt)
  };
}

async function workspaceIdForUser(userId: string, preferredWorkspaceId?: string): Promise<string> {
  const memberships = await listUserWorkspaces(userId);
  const workspace = preferredWorkspaceId
    ? memberships.find((entry) => entry.id === preferredWorkspaceId)
    : memberships[0];
  if (!workspace) {
    throw new ApiError(403, "User does not belong to an active workspace");
  }
  return workspace.id;
}

async function hydrateWorkspaceAuthorization<T extends {
  id: string;
  role: UserRole | null;
  permissions: RolePermission[];
  assignedRoles: Array<{ id: string; name: string; color: string }>;
}>(user: Omit<T, "permissions" | "assignedRoles">, workspaceId: string): Promise<T> {
  return runWithWorkspaceContext({ workspaceId, userId: user.id }, async () => ({
    ...user,
    permissions: Array.from(await getUserPermissions(user.id)).sort(),
    assignedRoles: await getAssignedRoles(user.id, workspaceId)
  })) as Promise<T>;
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  permissions: RolePermission[];
  assignedRoles: Array<{ id: string; name: string; color: string }>;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  dateOfBirth: Date | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
    assignedRoles: user.assignedRoles,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    age: user.age,
    dateOfBirth: user.dateOfBirth,
    createdAt: user.createdAt
  };
}

function toAccountUser(user: Omit<PublicUser, "role" | "permissions" | "assignedRoles">): PublicUser {
  return toPublicUser({ ...user, role: null, permissions: [], assignedRoles: [] });
}

export async function registerUser(input: RegisterBody, context?: Partial<AuditContext>): Promise<AuthResponse> {
  const auditContext = buildAuditContext(context);
  if (env.REGISTRATION_HONEYPOT_ENABLED && input.contactWebsite.trim().length > 0) {
    await recordAuditLog({
      action: "auth.register.blocked",
      targetType: "registration",
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      requestId: auditContext.requestId,
      metadata: { reason: "honeypot" }
    });
    throw new ApiError(400, "Unable to create account");
  }
  const email = normalizeEmail(input.email);
  const emailHash = hashAuditValue(email);
  const inviteToken = input.inviteToken?.trim();
  const invite = inviteToken ? await validateInviteForRegistration(inviteToken, email) : null;
  const safeName = sanitizeRequiredPlainText(input.name, { field: "Name", min: 2, max: 100 });

  const existingRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const existing = existingRows[0];

  if (existing) {
    await recordAuditLog({
      action: "auth.register.failure",
      targetType: "auth_email",
      targetId: emailHash,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      requestId: auditContext.requestId,
      metadata: { reason: "email_in_use" }
    });
    throw new ApiError(409, "Email is already in use");
  }

  const totalRows = await db
    .select({ totalUsers: count(users.id) })
    .from(users);
  const totalUsers = totalRows[0]?.totalUsers ?? 0;

  const testImplicitWorkspace = env.NODE_ENV === "test" && process.env.TEST_EXPLICIT_WORKSPACES !== "true";
  const workspaceId = invite?.workspaceId ?? (testImplicitWorkspace ? DEFAULT_WORKSPACE_ID : null);
  let roleIds: string[] = [];
  let membershipRole: UserRole | null = null;
  if (workspaceId) {
    const { adminRoleId, guestRoleId } = await getSystemRoleIds(workspaceId);
    roleIds = testImplicitWorkspace && totalUsers === 0 && !invite ? [adminRoleId] : (invite?.roleIds ?? [guestRoleId]);
    membershipRole = await resolveLegacyRole(roleIds, workspaceId);
  }
  const passwordHash = await bcrypt.hash(input.password, 12);
  const now = new Date();
  const userId = crypto.randomUUID();

  await db
    .insert(users)
    .values({
      id: userId,
      name: safeName,
      email,
      passwordHash,
      role: "guest",
      createdAt: now,
      updatedAt: now
    })
    .execute();

  if (!invite && workspaceId && membershipRole) {
    await db.insert(workspaceMemberships).values({
      workspaceId,
      userId,
      status: "active",
      role: membershipRole,
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    }).execute();
    await setUserRoles(userId, roleIds, workspaceId);
  }

  const createdRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const created = createdRows[0];

  if (!created) {
    throw new ApiError(500, "Failed to create user");
  }

  if (invite && workspaceId) {
    await consumeInvite(invite.inviteId, userId);
    await setUserRoles(userId, roleIds, workspaceId);
  }

  await recordAuditLog({
    actorId: created.id,
    action: "auth.register.success",
    targetType: "user",
    targetId: created.id,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    requestId: auditContext.requestId,
    metadata: {
      emailHash,
      role: membershipRole,
      firstUser: totalUsers === 0,
      invited: Boolean(invite)
    }
  });

  const token = signAccessToken({
    sub: created.id,
    email: created.email
  });

  return {
    token,
    user: await toAccountUserWithAssignment(created)
  };
}

export async function loginUser(input: LoginBody, context?: Partial<AuditContext>): Promise<AuthResponse> {
  const auditContext = buildAuditContext(context);
  const email = normalizeEmail(input.email);
  const emailHash = hashAuditValue(email);

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    await recordAuditLog({
      action: "auth.login.failure",
      targetType: "auth_email",
      targetId: emailHash,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      requestId: auditContext.requestId,
      metadata: { reason: "invalid_credentials" }
    });
    throw new ApiError(401, "Invalid email or password");
  }

  const validPassword = await bcrypt.compare(input.password, user.passwordHash);

  if (!validPassword) {
    await recordAuditLog({
      actorId: user.id,
      action: "auth.login.failure",
      targetType: "user",
      targetId: user.id,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      requestId: auditContext.requestId,
      metadata: { reason: "invalid_credentials", emailHash }
    });
    throw new ApiError(401, "Invalid email or password");
  }

  await recordAuditLog({
    actorId: user.id,
    action: "auth.login.success",
    targetType: "user",
    targetId: user.id,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    requestId: auditContext.requestId,
    metadata: { emailHash }
  });

  const token = signAccessToken({
    sub: user.id,
    email: user.email
  });

  return {
    token,
    user: await toAccountUserWithAssignment(user)
  };
}

export async function requestPasswordReset(
  input: ForgotPasswordBody,
  context?: Partial<AuditContext>
): Promise<GenericActionResponse> {
  const auditContext = buildAuditContext(context);
  const email = normalizeEmail(input.email);
  const emailHash = hashAuditValue(email);

  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userRows[0];

  if (user) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashAuditValue(rawToken);

    await db.delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.consumedAt)))
      .execute();

    await db.insert(passwordResetTokens)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash,
        expiresAt,
        consumedAt: null,
        createdAt: now
      })
      .execute();
  }

  await recordAuditLog({
    actorId: user?.id ?? null,
    action: "auth.forgot_password.requested",
    targetType: user ? "user" : "auth_email",
    targetId: user?.id ?? emailHash,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    requestId: auditContext.requestId,
    metadata: {
      emailHash,
      matchedAccount: Boolean(user),
      resetDeliveryEnabled: env.PASSWORD_RESET_ENABLED
    }
  });

  return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
}

export async function resetPassword(
  input: ResetPasswordBody,
  context?: Partial<AuditContext>
): Promise<GenericActionResponse> {
  const auditContext = buildAuditContext(context);
  const tokenHash = hashAuditValue(input.token.trim());

  const rows = await db
    .select({
      tokenId: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
      consumedAt: passwordResetTokens.consumedAt
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  const resetToken = rows[0];

  if (!resetToken || resetToken.consumedAt) {
    await recordAuditLog({
      action: "auth.reset_password.failure",
      targetType: "password_reset_token",
      targetId: tokenHash,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      requestId: auditContext.requestId,
      metadata: { reason: "invalid_token" }
    });
    throw new ApiError(400, "Invalid or expired reset token");
  }

  if (resetToken.expiresAt.getTime() <= Date.now()) {
    await recordAuditLog({
      actorId: resetToken.userId,
      action: "auth.reset_password.failure",
      targetType: "user",
      targetId: resetToken.userId,
      ip: auditContext.ip,
      userAgent: auditContext.userAgent,
      requestId: auditContext.requestId,
      metadata: { reason: "expired_token" }
    });
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const now = new Date();

  await db.update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, resetToken.userId))
    .execute();

  await db.update(passwordResetTokens)
    .set({ consumedAt: now })
    .where(eq(passwordResetTokens.id, resetToken.tokenId))
    .execute();

  await recordAuditLog({
    actorId: resetToken.userId,
    action: "auth.reset_password.success",
    targetType: "user",
    targetId: resetToken.userId,
    ip: auditContext.ip,
    userAgent: auditContext.userAgent,
    requestId: auditContext.requestId,
    metadata: {
      resetDeliveryEnabled: env.PASSWORD_RESET_ENABLED
    }
  });

  return { message: GENERIC_RESET_SUCCESS_MESSAGE };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const workspaceId = await workspaceIdForUser(userId, getOptionalWorkspaceId() ?? undefined);
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMemberships.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(and(eq(users.id, userId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return toPublicUser(await hydrateWorkspaceAuthorization({ ...user }, workspaceId));
}

export async function updateProfile(userId: string, input: UpdateProfileBody): Promise<PublicUser> {
  const now = new Date();
  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: now
  };

  if (input.name !== undefined) {
    updates.name = sanitizeRequiredPlainText(input.name, { field: "Name", min: 2, max: 100 });
  }

  if (input.username !== undefined) {
    if (input.username === null) {
      updates.username = null;
    } else {
      const normalized = input.username.trim();
      const existingRows = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, normalized), ne(users.id, userId)))
        .limit(1);

      const existing = existingRows[0];

      if (existing) {
        throw new ApiError(409, "Username is already in use");
      }

      updates.username = normalized;
    }
  }

  if (input.displayName !== undefined) {
    updates.displayName = sanitizeOptionalPlainText(input.displayName, { field: "Display name", max: 100 }) ?? null;
  }

  if (input.bio !== undefined) {
    updates.bio = sanitizeOptionalPlainText(input.bio, { field: "Bio", max: 500 }) ?? null;
  }

  if (input.age !== undefined) {
    updates.age = input.age;
  }

  if (input.dateOfBirth !== undefined) {
    updates.dateOfBirth = input.dateOfBirth;
  }

  await db.update(users).set(updates).where(eq(users.id, userId)).execute();

  const workspaceId = await workspaceIdForUser(userId, getOptionalWorkspaceId() ?? undefined);
  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMemberships.role,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(and(eq(users.id, userId), eq(workspaceMemberships.workspaceId, workspaceId)))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return toPublicUser(await hydrateWorkspaceAuthorization({ ...user }, workspaceId));
}

export async function getAccountUser(userId: string): Promise<PublicUser> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      age: users.age,
      dateOfBirth: users.dateOfBirth,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) throw new ApiError(404, "User not found");
  return toAccountUserWithAssignment(user);
}




