import crypto from "node:crypto";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
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
  author: {
    id: string;
    name: string;
    displayName: string | null;
    email: string;
  };
}

const normalizeIds = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

function ensureRolesExist(roleIds: string[]): void {
  if (roleIds.length === 0) return;
  const rows = db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, roleIds))
    .all();
  if (rows.length !== roleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }
}

function ensureUsersExist(userIds: string[]): void {
  if (userIds.length === 0) return;
  const rows = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, userIds))
    .all();
  if (rows.length !== userIds.length) {
    throw new ApiError(400, "One or more users are invalid");
  }
}

function getUserIdsForRoles(roleIds: string[]): string[] {
  if (roleIds.length === 0) return [];
  const rows = db
    .select({ userId: userRoleAssignments.userId })
    .from(userRoleAssignments)
    .where(inArray(userRoleAssignments.roleId, roleIds))
    .all();
  return rows.map((row) => row.userId);
}

function resolveRecipients(audience: AnnouncementAudienceInput): string[] {
  const sendToAll = Boolean(audience.sendToAll);
  const includeRoleIds = normalizeIds(audience.includeRoleIds ?? []);
  const excludeRoleIds = normalizeIds(audience.excludeRoleIds ?? []);
  const includeUserIds = normalizeIds(audience.includeUserIds ?? []);
  const excludeUserIds = normalizeIds(audience.excludeUserIds ?? []);

  if (!sendToAll && includeRoleIds.length === 0 && includeUserIds.length === 0) {
    throw new ApiError(400, "Select at least one audience option");
  }

  ensureRolesExist([...includeRoleIds, ...excludeRoleIds]);
  ensureUsersExist([...includeUserIds, ...excludeUserIds]);

  const recipients = new Set<string>();

  if (sendToAll) {
    const allUsers = db.select({ id: users.id }).from(users).all();
    allUsers.forEach((user) => recipients.add(user.id));
  } else {
    getUserIdsForRoles(includeRoleIds).forEach((id) => recipients.add(id));
  }

  if (excludeRoleIds.length > 0) {
    getUserIdsForRoles(excludeRoleIds).forEach((id) => recipients.delete(id));
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

export function listAnnouncementAudienceOptions(actorId: string): AnnouncementAudienceOptions {
  assertPermission(actorId, "send_announcements");
  const rolesList = db
    .select({ id: roles.id, name: roles.name, color: roles.color })
    .from(roles)
    .orderBy(desc(roles.priority), roles.name)
    .all();
  const usersList = db
    .select({ id: users.id, name: users.name, displayName: users.displayName, username: users.username, email: users.email, role: users.role })
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();
  return { roles: rolesList, users: usersList };
}

export function createAnnouncement(input: CreateAnnouncementInput, actorId: string): AnnouncementDetail {
  assertPermission(actorId, "send_announcements");

  const recipients = resolveRecipients(input.audience);
  const announcementId = crypto.randomUUID();
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(announcements)
      .values({
        id: announcementId,
        subject: input.subject.trim(),
        body: input.body.trim(),
        audience: serializeAudience(input.audience),
        createdBy: actorId,
        createdAt: now
      })
      .run();

    tx.insert(announcementRecipients)
      .values(recipients.map((userId) => ({ announcementId, userId, createdAt: now })))
      .run();
  });

  const author = db
    .select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, actorId))
    .get();

  return {
    id: announcementId,
    subject: input.subject.trim(),
    body: input.body.trim(),
    createdAt: now.getTime(),
    author: {
      id: author?.id ?? actorId,
      name: author?.name ?? "Unknown",
      displayName: author?.displayName ?? null,
      email: author?.email ?? ""
    }
  };
}

export function listUnreadAnnouncements(userId: string): AnnouncementDetail[] {
  const rows = db
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
    .limit(30)
    .all();

  return rows.map((row) => ({
    id: row.announcementId,
    subject: row.subject,
    body: row.body,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime(),
    author: {
      id: row.authorId,
      name: row.authorName,
      displayName: row.authorDisplayName ?? null,
      email: row.authorEmail
    }
  }));
}

export function markAnnouncementsSeen(userId: string, ids: string[]): void {
  const normalized = normalizeIds(ids);
  if (normalized.length === 0) return;

  db.update(announcementRecipients)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(announcementRecipients.userId, userId),
        inArray(announcementRecipients.announcementId, normalized),
        isNull(announcementRecipients.seenAt)
      )
    )
    .run();
}

export function canSendAnnouncements(userId: string): boolean {
  try {
    assertPermission(userId, "send_announcements");
    return true;
  } catch {
    return false;
  }
}
