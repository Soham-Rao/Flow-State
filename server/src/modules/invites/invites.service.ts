import crypto from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import { invites, users, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateInviteInput } from "./invites.schema.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface InviteSummary {
  id: string;
  email: string | null;
  role: UserRole;
  createdBy: string;
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
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}): InviteSummary {
  const now = new Date();
  return {
    id: row.id,
    email: row.email ?? null,
    role: row.role,
    createdBy: row.createdBy,
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

export function listInvites(): InviteSummary[] {
  const rows = db
    .select({
      id: invites.id,
      token: invites.token,
      email: invites.email,
      role: invites.role,
      createdBy: invites.createdBy,
      createdAt: invites.createdAt,
      updatedAt: invites.updatedAt,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt
    })
    .from(invites)
    .orderBy(desc(invites.createdAt))
    .all();

  return rows.map(toInviteSummary);
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
      return toInviteSummary(existingInvite);
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
      role: "member",
      createdBy: creatorId,
      expiresAt,
      createdAt: now,
      updatedAt: now
    })
    .run();

  const created = db
    .select({
      id: invites.id,
      token: invites.token,
      email: invites.email,
      role: invites.role,
      createdBy: invites.createdBy,
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

  return toInviteSummary(created);
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

export function validateInviteForRegistration(token: string, email: string): { inviteId: string; role: UserRole } {
  const invite = getInviteByToken(token);
  const now = new Date();
  const status = getInviteStatus(invite, now);

  if (status !== "pending") {
    throw new ApiError(410, "Invite is no longer valid");
  }

  if (invite.email && normalizeEmail(invite.email) !== normalizeEmail(email)) {
    throw new ApiError(400, "Invite email does not match");
  }

  return { inviteId: invite.id, role: invite.role };
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
