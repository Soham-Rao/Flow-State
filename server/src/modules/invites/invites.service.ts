import crypto from "node:crypto";

import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db, type DbTransaction } from "../../db/connection.js";
import { inviteRoleAssignments, invites, roles, userRoleAssignments, users, workspaceMemberships, workspaces, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertRoleHierarchy } from "../../utils/permissions.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";
import { getSystemRoleIds, resolveLegacyRole } from "../roles/roles.service.js";
import type { CreateInviteInput } from "./invites.schema.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

type InviteRow = {
  id: string;
  workspaceId: string;
  token: string;
  email: string | null;
  role: UserRole;
  createdBy: string;
  acceptedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export interface InviteSummary {
  id: string;
  workspaceId: string;
  email: string | null;
  role: UserRole;
  roleIds: string[];
  createdBy: string;
  acceptedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  status: InviteStatus;
  inviteUrl: string;
}

export interface InviteLookup {
  workspaceId: string;
  workspaceName: string;
  email: string | null;
  expiresAt: Date;
  status: InviteStatus;
}

function buildInviteUrl(token: string): string {
  const base = env.PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/register?invite=${token}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getInviteStatus(row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InviteStatus {
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "accepted";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

function toInviteSummary(row: {
  id: string;
  workspaceId: string;
  token: string;
  email: string | null;
  role: UserRole;
  createdBy: string;
  acceptedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}, roleIds: string[]): InviteSummary {
  const now = new Date();
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email ?? null,
    role: row.role,
    roleIds,
    createdBy: row.createdBy,
    acceptedBy: row.acceptedBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt ?? null,
    revokedAt: row.revokedAt ?? null,
    status: getInviteStatus(row, now),
    inviteUrl: buildInviteUrl(row.token)
  };
}

async function getInviteByToken(token: string): Promise<InviteRow> {
  const rows: InviteRow[] = await db
    .select({
      id: invites.id,
      workspaceId: invites.workspaceId,
      token: invites.token,
      email: invites.email,
      role: invites.role,
      createdBy: invites.createdBy,
      acceptedBy: invites.acceptedBy,
      createdAt: invites.createdAt,
      updatedAt: invites.updatedAt,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt
    })
    .from(invites)
    .where(eq(invites.token, token))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Invite not found");
  }

  return row;
}

async function getInviteById(inviteId: string): Promise<InviteRow> {
  const workspaceId = getCurrentWorkspaceId();
  const rows: InviteRow[] = await db
    .select({
      id: invites.id,
      workspaceId: invites.workspaceId,
      token: invites.token,
      email: invites.email,
      role: invites.role,
      createdBy: invites.createdBy,
      acceptedBy: invites.acceptedBy,
      createdAt: invites.createdAt,
      updatedAt: invites.updatedAt,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt
    })
    .from(invites)
    .where(and(eq(invites.id, inviteId), eq(invites.workspaceId, workspaceId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Invite not found");
  }

  return row;
}

async function getInviteRoleIds(inviteIds: string[]): Promise<Map<string, string[]>> {
  if (inviteIds.length === 0) return new Map();
  const rows: Array<{ inviteId: string; roleId: string }> = await db
    .select({ inviteId: inviteRoleAssignments.inviteId, roleId: inviteRoleAssignments.roleId })
    .from(inviteRoleAssignments)
    .where(inArray(inviteRoleAssignments.inviteId, inviteIds));

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.inviteId) ?? [];
    existing.push(row.roleId);
    map.set(row.inviteId, existing);
  }

  return map;
}

async function replaceInviteRoles(inviteId: string, roleIds: string[]): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx: DbTransaction) => {
    await tx.delete(inviteRoleAssignments).where(eq(inviteRoleAssignments.inviteId, inviteId)).execute();
    await tx.insert(inviteRoleAssignments)
      .values(roleIds.map((roleId) => ({ inviteId, roleId, createdAt: now })))
      .execute();
  });
}

export async function listInvites(): Promise<InviteSummary[]> {
  const workspaceId = getCurrentWorkspaceId();
  const rows: InviteRow[] = await db
    .select({
      id: invites.id,
      workspaceId: invites.workspaceId,
      token: invites.token,
      email: invites.email,
      role: invites.role,
      createdBy: invites.createdBy,
      acceptedBy: invites.acceptedBy,
      createdAt: invites.createdAt,
      updatedAt: invites.updatedAt,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt
    })
    .from(invites)
    .where(eq(invites.workspaceId, workspaceId))
    .orderBy(desc(invites.createdAt));

  const roleMap = await getInviteRoleIds(rows.map((row) => row.id));

  return rows.map((row) => toInviteSummary(row, roleMap.get(row.id) ?? []));
}

export async function createInvite(input: CreateInviteInput, creatorId: string): Promise<InviteSummary> {
  const workspaceId = getCurrentWorkspaceId();
  const email = input.email ? normalizeEmail(input.email) : null;

  if (email) {
    const existingUserRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUserRows[0]) {
      throw new ApiError(409, "User already exists");
    }

    const existingInviteRows: InviteRow[] = await db
      .select({
        id: invites.id,
        workspaceId: invites.workspaceId,
        token: invites.token,
        email: invites.email,
        role: invites.role,
        createdBy: invites.createdBy,
        acceptedBy: invites.acceptedBy,
        createdAt: invites.createdAt,
        updatedAt: invites.updatedAt,
        expiresAt: invites.expiresAt,
        acceptedAt: invites.acceptedAt,
        revokedAt: invites.revokedAt
      })
      .from(invites)
      .where(
        and(
          eq(invites.email, email),
          eq(invites.workspaceId, workspaceId),
          isNull(invites.acceptedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, new Date())
        )
      )
      .limit(1);

    const existingInvite = existingInviteRows[0];

    if (existingInvite) {
      const roleMap = await getInviteRoleIds([existingInvite.id]);
      return toInviteSummary(existingInvite, roleMap.get(existingInvite.id) ?? []);
    }
  }

  const now = new Date();
  const inviteId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  await db.insert(invites)
    .values({
      id: inviteId,
      workspaceId,
      token,
      email,
      role: "guest",
      createdBy: creatorId,
      expiresAt,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  const { guestRoleId } = await getSystemRoleIds(workspaceId);
  await replaceInviteRoles(inviteId, [guestRoleId]);

  const createdRows: InviteRow[] = await db
    .select({
      id: invites.id,
      workspaceId: invites.workspaceId,
      token: invites.token,
      email: invites.email,
      role: invites.role,
      createdBy: invites.createdBy,
      acceptedBy: invites.acceptedBy,
      createdAt: invites.createdAt,
      updatedAt: invites.updatedAt,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt
    })
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1);

  const created = createdRows[0];

  if (!created) {
    throw new ApiError(500, "Failed to create invite");
  }

  return toInviteSummary(created, [guestRoleId]);
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const workspaceId = getCurrentWorkspaceId();
  const [result] = await db
    .update(invites)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.workspaceId, workspaceId), isNull(invites.revokedAt)))
    .execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Invite not found");
  }
}

export async function lookupInvite(token: string): Promise<InviteLookup> {
  const invite = await getInviteByToken(token);
  const workspaceRows = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, invite.workspaceId)).limit(1);
  const workspaceName = workspaceRows[0]?.name;
  if (!workspaceName) throw new ApiError(410, "Invite workspace is no longer available");
  const now = new Date();
  const status = getInviteStatus(invite, now);

  return {
    workspaceId: invite.workspaceId,
    workspaceName,
    email: invite.email ?? null,
    expiresAt: invite.expiresAt,
    status
  };
}

export async function validateInviteForRegistration(token: string, email: string): Promise<{ inviteId: string; workspaceId: string; roleIds: string[] }> {
  const invite = await getInviteByToken(token);
  const now = new Date();
  const status = getInviteStatus(invite, now);

  if (status !== "pending") {
    throw new ApiError(410, "Invite is no longer valid");
  }

  if (invite.email && normalizeEmail(invite.email) !== normalizeEmail(email)) {
    throw new ApiError(400, "Invite email does not match");
  }

  const roleMap = await getInviteRoleIds([invite.id]);
  const roleIds = roleMap.get(invite.id) ?? [];
  if (roleIds.length === 0) {
    const { guestRoleId } = await getSystemRoleIds(invite.workspaceId);
    return { inviteId: invite.id, workspaceId: invite.workspaceId, roleIds: [guestRoleId] };
  }

  const validRoles = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.workspaceId, invite.workspaceId), inArray(roles.id, roleIds)));
  if (validRoles.length !== roleIds.length) {
    throw new ApiError(409, "Invite roles do not belong to the invite workspace");
  }

  return { inviteId: invite.id, workspaceId: invite.workspaceId, roleIds };
}

export async function consumeInvite(inviteId: string, userId: string): Promise<void> {
  await db.transaction(async (tx: DbTransaction) => {
    const rows = await tx.select({ workspaceId: invites.workspaceId, role: invites.role }).from(invites).where(eq(invites.id, inviteId)).limit(1);
    const workspaceId = rows[0]?.workspaceId;
    if (!workspaceId) throw new ApiError(404, "Invite not found");
    const now = new Date();
    const [result] = await tx
      .update(invites)
      .set({ acceptedAt: now, acceptedBy: userId, updatedAt: now })
      .where(and(eq(invites.id, inviteId), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
      .execute();

    if (result.affectedRows === 0) {
      throw new ApiError(409, "Invite has already been used");
    }

    await tx.insert(workspaceMemberships).ignore().values({
      workspaceId,
      userId,
      status: "active",
      role: rows[0]!.role,
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    }).execute();
    await tx.update(workspaceMemberships)
      .set({ status: "active", role: rows[0]!.role, updatedAt: now })
      .where(and(eq(workspaceMemberships.workspaceId, workspaceId), eq(workspaceMemberships.userId, userId)))
      .execute();
  });
}

export async function acceptInviteForExistingUser(token: string, userId: string): Promise<{ workspaceId: string }> {
  const userRows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) throw new ApiError(404, "User not found");

  const validated = await validateInviteForRegistration(token, user.email);
  const legacyRole = await resolveLegacyRole(validated.roleIds, validated.workspaceId);
  await db.transaction(async (tx: DbTransaction) => {
    const now = new Date();
    const [accepted] = await tx.update(invites)
      .set({ acceptedAt: now, acceptedBy: userId, updatedAt: now })
      .where(and(
        eq(invites.id, validated.inviteId),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt)
      ))
      .execute();
    if (accepted.affectedRows === 0) throw new ApiError(409, "Invite has already been used");
    await tx.insert(workspaceMemberships).ignore().values({
      workspaceId: validated.workspaceId,
      userId,
      status: "active",
      role: legacyRole,
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    }).execute();
    await tx.update(workspaceMemberships)
      .set({ status: "active", role: legacyRole, updatedAt: now })
      .where(and(
        eq(workspaceMemberships.workspaceId, validated.workspaceId),
        eq(workspaceMemberships.userId, userId)
      ))
      .execute();
    await tx.delete(userRoleAssignments).where(and(
      eq(userRoleAssignments.workspaceId, validated.workspaceId),
      eq(userRoleAssignments.userId, userId)
    )).execute();
    await tx.insert(userRoleAssignments).values(validated.roleIds.map((roleId) => ({
      workspaceId: validated.workspaceId,
      userId,
      roleId,
      createdAt: now
    }))).execute();
  });
  return { workspaceId: validated.workspaceId };
}

export async function updateInviteRoles(inviteId: string, roleIds: string[], actorId: string): Promise<InviteSummary> {
  const workspaceId = getCurrentWorkspaceId();
  const uniqueRoleIds = Array.from(new Set(roleIds));
  if (uniqueRoleIds.length === 0) {
    throw new ApiError(400, "At least one role is required");
  }

  const invite = await getInviteById(inviteId);
  const now = new Date();
  const status = getInviteStatus(invite, now);
  if (status !== "pending") {
    throw new ApiError(409, "Invite is no longer pending");
  }

  const rolesRows = await db
    .select({ id: roles.id, priority: roles.priority })
    .from(roles)
    .where(and(eq(roles.workspaceId, workspaceId), inArray(roles.id, uniqueRoleIds)));

  if (rolesRows.length !== uniqueRoleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }

  for (const role of rolesRows) {
    await assertRoleHierarchy(actorId, role.priority, { allowEqual: true });
  }

  await replaceInviteRoles(inviteId, uniqueRoleIds);

  const legacyRole: UserRole = await resolveLegacyRole(uniqueRoleIds, workspaceId);

  await db.update(invites).set({ role: legacyRole, updatedAt: new Date() }).where(and(eq(invites.id, inviteId), eq(invites.workspaceId, workspaceId))).execute();

  const refreshed = await getInviteById(inviteId);
  return toInviteSummary(refreshed, uniqueRoleIds);
}

