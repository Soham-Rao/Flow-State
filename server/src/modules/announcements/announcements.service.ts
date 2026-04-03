import crypto from "node:crypto";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/connection.js";
import {
  announcementRecipients,
  announcements,
  roles,
  userRoleAssignments,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertPermission } from "../../utils/permissions.js";
import type { AnnouncementAudienceInput, CreateAnnouncementInput } from "./announcements.schema.js";

export interface AnnouncementAudienceOptions {
  roles: Array<{ id: string; name: string; color: string }>;
  users: Array<{ id: string; name: string; displayName: string | null; username: string | null; email: string; role: string }>;
}

export interface AnnouncementDetail {
  id: string;
  subject: string;
  body: string;
  createdAt: number;
  seenAt: number | null;
  author: {
    id: string;
    name: string;
    displayName: string | null;
    email: string;
  };
}

const normalizeIds = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

async function ensureRolesExist(roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return;
  const rows: Array<{ id: string }> = await db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, roleIds));
  if (rows.length !== roleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }
}

async function ensureUsersExist(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const rows: Array<{ id: string }> = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds));
  if (rows.length !== userIds.length) {
    throw new ApiError(400, "One or more users are invalid");
  }
}

async function getUserIdsForRoles(roleIds: string[]): Promise<string[]> {
  if (roleIds.length === 0) return [];
  const rows: Array<{ userId: string }> = await db
    .select({ userId: userRoleAssignments.userId })
    .from(userRoleAssignments)
    .where(inArray(userRoleAssignments.roleId, roleIds));
  return rows.map((row) => row.userId);
}

async function resolveRecipients(audience: AnnouncementAudienceInput): Promise<string[]> {
  const sendToAll = Boolean(audience.sendToAll);
  const includeRoleIds = normalizeIds(audience.includeRoleIds ?? []);
  const excludeRoleIds = normalizeIds(audience.excludeRoleIds ?? []);
  const includeUserIds = normalizeIds(audience.includeUserIds ?? []);
  const excludeUserIds = normalizeIds(audience.excludeUserIds ?? []);

  if (!sendToAll && includeRoleIds.length === 0 && includeUserIds.length === 0) {
    throw new ApiError(400, "Select at least one audience option");
  }

  await ensureRolesExist([...includeRoleIds, ...excludeRoleIds]);
  await ensureUsersExist([...includeUserIds, ...excludeUserIds]);

  const recipients = new Set<string>();

  if (sendToAll) {
    const allUsers: Array<{ id: string }> = await db.select({ id: users.id }).from(users);
    allUsers.forEach((user) => recipients.add(user.id));
  } else {
    (await getUserIdsForRoles(includeRoleIds)).forEach((id) => recipients.add(id));
  }

  if (excludeRoleIds.length > 0) {
    (await getUserIdsForRoles(excludeRoleIds)).forEach((id) => recipients.delete(id));
  }

  includeUserIds.forEach((id) => recipients.add(id));
  excludeUserIds.forEach((id) => recipients.delete(id));

  if (recipients.size === 0) {
    throw new ApiError(400, "No recipients matched the selected audience");
  }

  return Array.from(recipients);
}

function serializeAudience(audience: AnnouncementAudienceInput): string {
  const normalized = {
    sendToAll: Boolean(audience.sendToAll),
    includeRoleIds: normalizeIds(audience.includeRoleIds ?? []),
    excludeRoleIds: normalizeIds(audience.excludeRoleIds ?? []),
    includeUserIds: normalizeIds(audience.includeUserIds ?? []),
    excludeUserIds: normalizeIds(audience.excludeUserIds ?? [])
  };
  return JSON.stringify(normalized);
}

export async function listAnnouncementAudienceOptions(actorId: string): Promise<AnnouncementAudienceOptions> {
  await assertPermission(actorId, "send_announcements");
  const rolesList = await db
    .select({ id: roles.id, name: roles.name, color: roles.color })
    .from(roles)
    .orderBy(desc(roles.priority), roles.name);
  const usersList = await db
    .select({ id: users.id, name: users.name, displayName: users.displayName, username: users.username, email: users.email, role: users.role })
    .from(users)
    .orderBy(desc(users.createdAt));
  return { roles: rolesList, users: usersList };
}

export async function createAnnouncement(input: CreateAnnouncementInput, actorId: string): Promise<AnnouncementDetail> {
  await assertPermission(actorId, "send_announcements");

  const recipients = await resolveRecipients(input.audience);
  const announcementId = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(announcements)
      .values({
        id: announcementId,
        subject: input.subject.trim(),
        body: input.body.trim(),
        audience: serializeAudience(input.audience),
        createdBy: actorId,
        createdAt: now
      })
      .execute();

    await tx.insert(announcementRecipients)
      .values(recipients.map((userId) => ({ announcementId, userId, createdAt: now })))
      .execute();
  });

  const authorRows = await db
    .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);

  const author = authorRows[0];

  return {
    id: announcementId,
    subject: input.subject.trim(),
    body: input.body.trim(),
    createdAt: now.getTime(),
    seenAt: null,
    author: {
      id: author?.id ?? actorId,
      name: author?.name ?? "Unknown",
      displayName: author?.displayName ?? null,
      email: author?.email ?? ""
    }
  };
}

export async function listAnnouncements(userId: string): Promise<AnnouncementDetail[]> {
  const rows: Array<{
      announcementId: string;
      subject: string;
      body: string;
      createdAt: Date | number;
      seenAt: Date | null;
      authorId: string;
      authorName: string;
      authorDisplayName: string | null;
      authorEmail: string;
    }> = await db
    .select({
      announcementId: announcements.id,
      subject: announcements.subject,
      body: announcements.body,
      createdAt: announcements.createdAt,
      seenAt: announcementRecipients.seenAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorEmail: users.email
    })
    .from(announcementRecipients)
    .innerJoin(announcements, eq(announcementRecipients.announcementId, announcements.id))
    .innerJoin(users, eq(announcements.createdBy, users.id))
    .where(eq(announcementRecipients.userId, userId))
    .orderBy(desc(announcements.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.announcementId,
    subject: row.subject,
    body: row.body,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime(),
    seenAt: row.seenAt ? new Date(row.seenAt).getTime() : null,
    author: {
      id: row.authorId,
      name: row.authorName,
      displayName: row.authorDisplayName ?? null,
      email: row.authorEmail
    }
  }));
}
export async function listUnreadAnnouncements(userId: string): Promise<AnnouncementDetail[]> {
  const rows: Array<{
      announcementId: string;
      subject: string;
      body: string;
      createdAt: Date | number;
      authorId: string;
      authorName: string;
      authorDisplayName: string | null;
      authorEmail: string;
    }> = await db
    .select({
      announcementId: announcements.id,
      subject: announcements.subject,
      body: announcements.body,
      createdAt: announcements.createdAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorEmail: users.email
    })
    .from(announcementRecipients)
    .innerJoin(announcements, eq(announcementRecipients.announcementId, announcements.id))
    .innerJoin(users, eq(announcements.createdBy, users.id))
    .where(and(eq(announcementRecipients.userId, userId), isNull(announcementRecipients.seenAt)))
    .orderBy(desc(announcements.createdAt))
    .limit(30);

  return rows.map((row) => ({
    id: row.announcementId,
    subject: row.subject,
    body: row.body,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime(),
    seenAt: null,
    author: {
      id: row.authorId,
      name: row.authorName,
      displayName: row.authorDisplayName ?? null,
      email: row.authorEmail
    }
  }));
}

export async function markAnnouncementsSeen(userId: string, ids: string[]): Promise<void> {
  const normalized = normalizeIds(ids);
  if (normalized.length === 0) return;

  await db.update(announcementRecipients)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(announcementRecipients.userId, userId),
        inArray(announcementRecipients.announcementId, normalized),
        isNull(announcementRecipients.seenAt)
      )
    )
    .execute();
}

export async function deleteAnnouncementsForUser(userId: string, ids: string[]): Promise<string[]> {
  const normalized = normalizeIds(ids);
  if (normalized.length === 0) return [];

  await db.delete(announcementRecipients)
    .where(
      and(
        eq(announcementRecipients.userId, userId),
        inArray(announcementRecipients.announcementId, normalized)
      )
    )
    .execute();

  return normalized;
}

export async function canSendAnnouncements(userId: string): Promise<boolean> {
  try {
    await assertPermission(userId, "send_announcements");
    return true;
  } catch {
    return false;
  }
}




