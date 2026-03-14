import crypto from "node:crypto";

import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import { inviteRoleAssignments, invites, roles, users, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertRoleHierarchy } from "../../utils/permissions.js";
import { getSystemRoleIds } from "../roles/roles.service.js";
import type { CreateInviteInput } from "./invites.schema.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface InviteSummary {
  id: string;
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
  email: string | null;
  expiresAt: Date;
  status: InviteStatus;
}

function buildInviteUrl(token: string): string {
  const base = env.CLIENT_ORIGIN.replace(/\/$/, "");
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

function getInviteByToken(token: string): {
  id: string;
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
} {
  const row = db
    .select({
      id: invites.id,
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
    .limit(1)
    .get();

  if (!row) {
    throw new ApiError(404, "Invite not found");
  }

  return row;
}

function getInviteById(inviteId: string): {
  id: string;
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
} {
  const row = db
    .select({
      id: invites.id,
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
    .limit(1)
    .get();

  if (!row) {
    throw new ApiError(404, "Invite not found");
  }

  return row;
}

function getInviteRoleIds(inviteIds: string[]): Map<string, string[]> {
  if (inviteIds.length === 0) return new Map();
  const rows = db
    .select({ inviteId: inviteRoleAssignments.inviteId, roleId: inviteRoleAssignments.roleId })
    .from(inviteRoleAssignments)
    .where(inArray(inviteRoleAssignments.inviteId, inviteIds))
    .all();

  const map = new Map<string, string[]>();
  for (const row of rows) {
    const existing = map.get(row.inviteId) ?? [];
    existing.push(row.roleId);
    map.set(row.inviteId, existing);
  }

  return map;
}

function replaceInviteRoles(inviteId: string, roleIds: string[]): void {
  const now = new Date();
  db.transaction((tx) => {
    tx.delete(inviteRoleAssignments).where(eq(inviteRoleAssignments.inviteId, inviteId)).run();
    tx.insert(inviteRoleAssignments)
      .values(roleIds.map((roleId) => ({ inviteId, roleId, createdAt: now })))
      .run();
  });
}

export function listInvites(): InviteSummary[] {
  const rows = db
    .select({
      id: invites.id,
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
    .orderBy(desc(invites.createdAt))
    .all();

  const roleMap = getInviteRoleIds(rows.map((row) => row.id));

  return rows.map((row) => toInviteSummary(row, roleMap.get(row.id) ?? []));
}

export function createInvite(input: CreateInviteInput, creatorId: string): InviteSummary {
  const email = input.email ? normalizeEmail(input.email) : null;

  if (email) {
    const existingUser = db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1).get();
    if (existingUser) {
      throw new ApiError(409, "User already exists");
    }

    const existingInvite = db
      .select({
        id: invites.id,
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
          isNull(invites.acceptedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, new Date())
        )
      )
      .limit(1)
      .get();

    if (existingInvite) {
      const roleMap = getInviteRoleIds([existingInvite.id]);
      return toInviteSummary(existingInvite, roleMap.get(existingInvite.id) ?? []);
    }
  }

  const now = new Date();
  const inviteId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  db.insert(invites)
    .values({
      id: inviteId,
      token,
      email,
      role: "guest",
      createdBy: creatorId,
      expiresAt,
      createdAt: now,
      updatedAt: now
    })
    .run();

  const { guestRoleId } = getSystemRoleIds();
  replaceInviteRoles(inviteId, [guestRoleId]);

  const created = db
    .select({
      id: invites.id,
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
    .get();

  if (!created) {
    throw new ApiError(500, "Failed to create invite");
  }

  return toInviteSummary(created, [guestRoleId]);
}

export function revokeInvite(inviteId: string): void {
  const result = db
    .update(invites)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(invites.id, inviteId), isNull(invites.revokedAt)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(404, "Invite not found");
  }
}

export function lookupInvite(token: string): InviteLookup {
  const invite = getInviteByToken(token);
  const now = new Date();
  const status = getInviteStatus(invite, now);

  return {
    email: invite.email ?? null,
    expiresAt: invite.expiresAt,
    status
  };
}

export function validateInviteForRegistration(token: string, email: string): { inviteId: string; roleIds: string[] } {
  const invite = getInviteByToken(token);
  const now = new Date();
  const status = getInviteStatus(invite, now);

  if (status !== "pending") {
    throw new ApiError(410, "Invite is no longer valid");
  }

  if (invite.email && normalizeEmail(invite.email) !== normalizeEmail(email)) {
    throw new ApiError(400, "Invite email does not match");
  }

  const roleMap = getInviteRoleIds([invite.id]);
  const roleIds = roleMap.get(invite.id) ?? [];
  if (roleIds.length === 0) {
    const { guestRoleId } = getSystemRoleIds();
    return { inviteId: invite.id, roleIds: [guestRoleId] };
  }

  return { inviteId: invite.id, roleIds };
}

export function consumeInvite(inviteId: string, userId: string): void {
  const result = db
    .update(invites)
    .set({ acceptedAt: new Date(), acceptedBy: userId, updatedAt: new Date() })
    .where(and(eq(invites.id, inviteId), isNull(invites.acceptedAt), isNull(invites.revokedAt)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(409, "Invite has already been used");
  }
}

export function updateInviteRoles(inviteId: string, roleIds: string[], actorId: string): InviteSummary {
  const uniqueRoleIds = Array.from(new Set(roleIds));
  if (uniqueRoleIds.length === 0) {
    throw new ApiError(400, "At least one role is required");
  }

  const invite = getInviteById(inviteId);
  const now = new Date();
  const status = getInviteStatus(invite, now);
  if (status !== "pending") {
    throw new ApiError(409, "Invite is no longer pending");
  }

  const rolesRows = db
    .select({ id: roles.id, priority: roles.priority })
    .from(roles)
    .where(inArray(roles.id, uniqueRoleIds))
    .all();

  if (rolesRows.length !== uniqueRoleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }

  for (const role of rolesRows) {
    assertRoleHierarchy(actorId, role.priority);
  }

  replaceInviteRoles(inviteId, uniqueRoleIds);

  const { adminRoleId, memberRoleId } = getSystemRoleIds();
  const legacyRole: UserRole = uniqueRoleIds.includes(adminRoleId)
    ? "admin"
    : uniqueRoleIds.includes(memberRoleId)
      ? "member"
      : "guest";
  db.update(invites).set({ role: legacyRole, updatedAt: new Date() }).where(eq(invites.id, inviteId)).run();

  const refreshed = getInviteById(inviteId);
  return toInviteSummary(refreshed, uniqueRoleIds);
}
