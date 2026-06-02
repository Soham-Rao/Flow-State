import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import {
  threadConversations,
  threadMemberPermissions,
  threadMembers,
  threadMessageDeletions,
  threadMessages,
  users,
  type UserRole,
  type ThreadMemberRole
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { sanitizeOptionalPlainText, sanitizeRequiredPlainText } from "../../utils/sanitize.js";
import { assertPermission, userHasPermission } from "../../utils/permissions.js";
import type {
  ChannelConversationSummary,
  ChannelMemberSummary,
  DmConversationSummary,
  ThreadPermissionOverride,
  ThreadUserSummary
} from "./threads.service.types.js";
import {
  assertConversationMember,
  assertConversationPermission,
  ensureUserExists,
  getConversation,
  userHasConversationPermission
} from "./threads.service.access.js";
import { buildMessagePreview, getDmConversationRows, getThreadMessageMentionCounts, getThreadReplyMentionCountsByConversation } from "./threads.service.data.js";
import type { AddChannelMembersInput, CreateChannelInput, UpdateChannelInput, UpdateChannelMemberOverridesInput } from "./threads.schema.js";

const CHANNEL_OVERRIDE_PERMISSIONS = new Set(["channel_read", "channel_write", "channel_edit", "channel_members_add", "channel_members_remove", "channel_manage_overrides", "channel_delete"]);

async function canUseDmWithAdmins(userId: string): Promise<boolean> {
  const user = await ensureUserExists(userId);
  return user.role === "guest";
}

async function assertDmDiscoveryPermission(userId: string): Promise<"all" | "admins"> {
  if (await userHasPermission(userId, "dm_read")) {
    return "all";
  }
  if (await canUseDmWithAdmins(userId)) {
    return "admins";
  }
  throw new ApiError(403, "You do not have permission to perform this action");
}

async function assertDmStartPermission(userId: string, otherUserId: string): Promise<ThreadUserSummary> {
  const otherUser = await ensureUserExists(otherUserId);
  if (await userHasPermission(userId, "dm_write")) {
    return otherUser;
  }
  const user = await ensureUserExists(userId);
  if (user.role === "guest" && otherUser.role === "admin") {
    return otherUser;
  }
  throw new ApiError(403, "You do not have permission to perform this action");
}

function normalizeChannelOverrides(overrides?: ThreadPermissionOverride[]): ThreadPermissionOverride[] {
  if (!overrides || overrides.length === 0) return [];
  const map = new Map<string, ThreadPermissionOverride>();
  for (const override of overrides) {
    if (!CHANNEL_OVERRIDE_PERMISSIONS.has(override.permission)) continue;
    map.set(override.permission, override);
  }
  return Array.from(map.values());
}

async function setMemberOverrides(conversationId: string, userId: string, overrides?: ThreadPermissionOverride[]): Promise<void> {
  const normalized = normalizeChannelOverrides(overrides);
  await db.delete(threadMemberPermissions)
    .where(and(eq(threadMemberPermissions.conversationId, conversationId), eq(threadMemberPermissions.userId, userId)))
    .execute();
  if (normalized.length === 0) return;
  const now = new Date();
  await db.insert(threadMemberPermissions)
    .values(normalized.map((override) => ({
      conversationId,
      userId,
      permission: override.permission,
      access: override.access,
      createdAt: now
    })))
    .execute();
}

export async function listDmUsers(userId: string): Promise<ThreadUserSummary[]> {
  const mode = await assertDmDiscoveryPermission(userId);
  if (mode === "admins") {
    return db
      .select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        username: users.username,
        email: users.email,
        bio: users.bio,
        role: users.role
      })
      .from(users)
      .where(eq(users.role, "admin"))
      .orderBy(users.name);
  }

  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      bio: users.bio,
      role: users.role
    })
    .from(users)
    .orderBy(users.name);
}

export async function listDmConversations(userId: string): Promise<DmConversationSummary[]> {
  const mode = await assertDmDiscoveryPermission(userId);

  const allRows = await getDmConversationRows(userId);
  const rows = mode === "all"
    ? allRows
    : (await Promise.all(allRows.map(async (row) => (
      await userHasConversationPermission(userId, row.id, "dm_read") ? row : null
    )))).filter((row): row is (typeof allRows)[number] => row !== null);

  if (rows.length === 0) {
    return [];
  }

  const conversationIds = rows.map((row) => row.id);
  const mentionCounts = await getThreadMessageMentionCounts(userId, conversationIds);
  const replyMentionCounts = await getThreadReplyMentionCountsByConversation(userId, conversationIds);

  const summaries: DmConversationSummary[] = await Promise.all(rows.map(async (row) => {
    const otherMembers = await db
      .select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        username: users.username,
        email: users.email,
        bio: users.bio,
        role: users.role
      })
      .from(threadMembers)
      .innerJoin(users, eq(threadMembers.userId, users.id))
      .where(and(eq(threadMembers.conversationId, row.id), ne(threadMembers.userId, userId)))
      .limit(1);

    const otherMember = otherMembers[0];
    const otherUser = otherMember ?? await ensureUserExists(userId);

    const lastMessages = await db
      .select({
        body: threadMessages.body,
        bodyEncrypted: threadMessages.bodyEncrypted,
        encryptionVersion: threadMessages.encryptionVersion,
        authorId: threadMessages.authorId,
        createdAt: threadMessages.createdAt,
        deletedAt: threadMessages.deletedAt
      })
      .from(threadMessages)
      .leftJoin(
        threadMessageDeletions,
        and(eq(threadMessageDeletions.messageId, threadMessages.id), eq(threadMessageDeletions.userId, userId))
      )
      .where(and(eq(threadMessages.conversationId, row.id), isNull(threadMessageDeletions.messageId)))
      .orderBy(desc(threadMessages.createdAt))
      .limit(1);

    const lastMessage = lastMessages[0];

    const preview = lastMessage ? buildMessagePreview("dm", lastMessage) : null;
    const lastMessageAt = lastMessage?.createdAt ?? row.lastMessageAt ?? row.createdAt ?? null;
    const lastReadAt = row.lastReadAt ?? null;
    const hasUnread = Boolean(
      lastMessage &&
      lastMessageAt &&
      lastMessage.authorId !== userId &&
      (!lastReadAt || new Date(lastReadAt).getTime() < new Date(lastMessageAt).getTime())
    );

    return {
      id: row.id,
      type: "dm" as const,
      otherUser,
      lastMessageAt: lastMessageAt ?? null,
      lastMessagePreview: preview,
      unreadMentions: mentionCounts.get(row.id) ?? 0,
      unreadReplyMentions: replyMentionCounts.get(row.id) ?? 0,
      hasUnread
    };
  }));

  return summaries.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getOrCreateDmConversation(userId: string, otherUserId: string): Promise<DmConversationSummary> {
  const otherUser = await assertDmStartPermission(userId, otherUserId);

  const existingMemberships: Array<{ conversationId: string }> = await db
    .select({ conversationId: threadMembers.conversationId })
    .from(threadMembers)
    .where(eq(threadMembers.userId, userId));

  const candidateIds = existingMemberships.map((row) => row.conversationId);
  let existingId: string | null = null;

  if (candidateIds.length > 0) {
    if (userId === otherUserId) {
      for (const id of candidateIds) {
        const conversationRows = await db
          .select({ id: threadConversations.id })
          .from(threadConversations)
          .where(and(eq(threadConversations.id, id), eq(threadConversations.type, "dm")))
          .limit(1);
        const conversation = conversationRows[0];
        if (!conversation) continue;
        const countRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(threadMembers)
          .where(eq(threadMembers.conversationId, id))
          .limit(1);
        if ((countRows[0]?.count ?? 0) === 1) {
          existingId = id;
          break;
        }
      }
    } else {
      const otherMembershipRows: Array<{ conversationId: string }> = await db
        .select({ conversationId: threadMembers.conversationId })
        .from(threadMembers)
        .where(and(inArray(threadMembers.conversationId, candidateIds), eq(threadMembers.userId, otherUserId)));

      const otherMemberships = otherMembershipRows.map((row) => row.conversationId);

      for (const id of otherMemberships) {
        const conversationRows = await db
          .select({ id: threadConversations.id })
          .from(threadConversations)
          .where(and(eq(threadConversations.id, id), eq(threadConversations.type, "dm")))
          .limit(1);
        const conversation = conversationRows[0];
        if (!conversation) continue;
        const countRows = await db
          .select({ count: sql<number>`count(*)` })
          .from(threadMembers)
          .where(eq(threadMembers.conversationId, id))
          .limit(1);
        if ((countRows[0]?.count ?? 0) <= 2) {
          existingId = id;
          break;
        }
      }
    }
  }

  if (existingId) {
    const summaries = await listDmConversations(userId);
    const existingSummary = summaries.find((summary) => summary.id === existingId);
    if (existingSummary) {
      return existingSummary;
    }
  }

  const now = new Date();
  const conversationId = crypto.randomUUID();
  await db.insert(threadConversations)
    .values({
      id: conversationId,
      type: "dm",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null
    })
    .execute();

  const members = [
    {
      conversationId,
      userId,
      role: "member" as const,
      createdAt: now,
      lastReadAt: null
    }
  ];
  if (userId !== otherUserId) {
    members.push({
      conversationId,
      userId: otherUserId,
      role: "member" as const,
      createdAt: now,
      lastReadAt: null
    });
  }

  await db.insert(threadMembers)
    .values(members)
    .execute();

  return {
    id: conversationId,
    type: "dm",
    otherUser: otherUser ?? await ensureUserExists(userId),
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadMentions: 0,
    unreadReplyMentions: 0,
    hasUnread: false
  };
}

export async function listChannelConversations(userId: string): Promise<ChannelConversationSummary[]> {
  const rows: Array<{
      id: string;
      name: string | null;
      description: string | null;
      createdBy: string | null;
      lastMessageAt: Date | null;
      createdAt: Date;
      lastReadAt: Date | null;
    }> = await db
    .select({
      id: threadConversations.id,
      name: threadConversations.name,
      description: threadConversations.description,
      createdBy: threadConversations.createdBy,
      lastMessageAt: threadConversations.lastMessageAt,
      createdAt: threadConversations.createdAt,
      lastReadAt: threadMembers.lastReadAt
    })
    .from(threadMembers)
    .innerJoin(threadConversations, eq(threadMembers.conversationId, threadConversations.id))
    .where(and(eq(threadMembers.userId, userId), eq(threadConversations.type, "channel")));

  if (rows.length === 0) {
    return [];
  }

  const permissions = await Promise.all(rows.map((row) => userHasConversationPermission(userId, row.id, "channel_read")));
  const permittedRows = rows.filter((_, index) => permissions[index]);
  if (permittedRows.length === 0) {
    return [];
  }

  const conversationIds = permittedRows.map((row) => row.id);
  const mentionCounts = await getThreadMessageMentionCounts(userId, conversationIds);
  const replyMentionCounts = await getThreadReplyMentionCountsByConversation(userId, conversationIds);

  const memberCounts: Array<{ conversationId: string; count: number }> = await db
    .select({ conversationId: threadMembers.conversationId, count: sql<number>`count(*)` })
    .from(threadMembers)
    .where(inArray(threadMembers.conversationId, conversationIds))
    .groupBy(threadMembers.conversationId);
  const memberCountById = new Map(memberCounts.map((row) => [row.conversationId, row.count]));

  const summaries: ChannelConversationSummary[] = await Promise.all(permittedRows.map(async (row) => {
    const lastMessages = await db
      .select({
        body: threadMessages.body,
        bodyEncrypted: threadMessages.bodyEncrypted,
        encryptionVersion: threadMessages.encryptionVersion,
        authorId: threadMessages.authorId,
        createdAt: threadMessages.createdAt,
        deletedAt: threadMessages.deletedAt
      })
      .from(threadMessages)
      .leftJoin(
        threadMessageDeletions,
        and(eq(threadMessageDeletions.messageId, threadMessages.id), eq(threadMessageDeletions.userId, userId))
      )
      .where(and(eq(threadMessages.conversationId, row.id), isNull(threadMessageDeletions.messageId)))
      .orderBy(desc(threadMessages.createdAt))
      .limit(1);

    const lastMessage = lastMessages[0];

    const preview = lastMessage ? buildMessagePreview("channel", lastMessage) : null;
    const lastMessageAt = lastMessage?.createdAt ?? row.lastMessageAt ?? row.createdAt ?? null;
    const lastReadAt = row.lastReadAt ?? null;
    const hasUnread = Boolean(
      lastMessage &&
      lastMessageAt &&
      lastMessage.authorId !== userId &&
      (!lastReadAt || new Date(lastReadAt).getTime() < new Date(lastMessageAt).getTime())
    );

    return {
      id: row.id,
      type: "channel" as const,
      name: row.name ?? "Untitled channel",
      description: row.description ?? null,
      createdById: row.createdBy ?? null,
      lastMessageAt: lastMessageAt ?? null,
      lastMessagePreview: preview,
      unreadMentions: mentionCounts.get(row.id) ?? 0,
      unreadReplyMentions: replyMentionCounts.get(row.id) ?? 0,
      hasUnread,
      memberCount: memberCountById.get(row.id) ?? 0
    };
  }));

  return summaries.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function createChannelConversation(userId: string, input: CreateChannelInput): Promise<ChannelConversationSummary> {
  await assertPermission(userId, "channel_write");

  const now = new Date();
  const conversationId = crypto.randomUUID();
  const name = sanitizeRequiredPlainText(input.name, { field: "Channel name", min: 1, max: 80 });
  const normalizedDescription = sanitizeOptionalPlainText(input.description, { field: "Channel description", max: 500 }) ?? null;

  await db.insert(threadConversations)
    .values({
      id: conversationId,
      type: "channel",
      name,
      description: normalizedDescription,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null
    })
    .execute();

  await db.insert(threadMembers)
    .values({
      conversationId,
      userId,
      role: "admin",
      createdAt: now,
      lastReadAt: null
    })
    .execute();

  const members = input.members ?? [];
  for (const member of members) {
    if (member.userId === userId) {
      continue;
    }
    await ensureUserExists(member.userId);
    try {
      await db.insert(threadMembers)
        .values({
          conversationId,
          userId: member.userId,
          role: member.role ?? "member",
          createdAt: now,
          lastReadAt: null
        })
        .execute();
    } catch {
      // ignore duplicates
    }
    await setMemberOverrides(conversationId, member.userId, member.overrides);
  }

  return {
    id: conversationId,
    type: "channel",
    name,
    description: normalizedDescription,
    createdById: userId,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadMentions: 0,
    unreadReplyMentions: 0,
    hasUnread: false,
    memberCount: 1 + members.filter((member) => member.userId !== userId).length
  };
}

export async function updateChannelConversation(
  userId: string,
  conversationId: string,
  input: UpdateChannelInput
): Promise<ChannelConversationSummary> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations can be updated");
  }


  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    await assertConversationPermission(userId, conversationId, "channel_edit");
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    updates.name = sanitizeRequiredPlainText(input.name, { field: "Channel name", min: 1, max: 80 });
  }
  if (input.description !== undefined) {
    updates.description = sanitizeOptionalPlainText(input.description, { field: "Channel description", max: 500 }) ?? null;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    await db.update(threadConversations)
      .set(updates)
      .where(eq(threadConversations.id, conversationId))
      .execute();
  }

  const summaries = await listChannelConversations(userId);
  const updated = summaries.find((summary) => summary.id === conversationId);
  if (!updated) {
    throw new ApiError(404, "Channel not found");
  }
  return updated;
}

export async function leaveChannelConversation(userId: string, conversationId: string): Promise<{ id: string }> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations can be left");
  }

  await assertConversationMember(userId, conversationId);

  await db.delete(threadMemberPermissions)
    .where(and(eq(threadMemberPermissions.conversationId, conversationId), eq(threadMemberPermissions.userId, userId)))
    .execute();
  await db.delete(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .execute();

  return { id: conversationId };
}

export async function deleteChannelConversation(userId: string, conversationId: string): Promise<{ id: string }> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations can be deleted");
  }

  const isCreator = conversation.createdBy === userId;
  if (!isCreator && !(await userHasConversationPermission(userId, conversationId, "channel_delete"))) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  if (!isCreator) {
    await assertConversationMember(userId, conversationId);
  }

  const uploadsRoot = path.join(env.FLOWSTATE_UPLOADS_DIR, "threads", conversationId);
  void fs.rm(uploadsRoot, { recursive: true, force: true }).catch(() => {});

  await db.delete(threadConversations)
    .where(eq(threadConversations.id, conversationId))
    .execute();

  return { id: conversationId };
}
export async function listChannelMembers(userId: string, conversationId: string): Promise<ChannelMemberSummary[]> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support member listing");
  }

  await assertConversationMember(userId, conversationId);
  await assertConversationPermission(userId, conversationId, "channel_read");

  const members: Array<{
      userId: string;
      name: string;
      displayName: string | null;
      username: string | null;
      email: string;
      bio: string | null;
      role: UserRole;
      memberRole: ThreadMemberRole;
    }> = await db
    .select({
      userId: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      bio: users.bio,
      role: users.role,
      memberRole: threadMembers.role
    })
    .from(threadMembers)
    .innerJoin(users, eq(threadMembers.userId, users.id))
    .where(eq(threadMembers.conversationId, conversationId))
    .orderBy(users.name);

  const overrides: Array<{
      userId: string;
      permission: string;
      access: "allow" | "deny";
    }> = await db
    .select({
      userId: threadMemberPermissions.userId,
      permission: threadMemberPermissions.permission,
      access: threadMemberPermissions.access
    })
    .from(threadMemberPermissions)
    .where(eq(threadMemberPermissions.conversationId, conversationId));

  const overridesByUser = new Map<string, ThreadPermissionOverride[]>();
  for (const override of overrides) {
    if (!CHANNEL_OVERRIDE_PERMISSIONS.has(override.permission)) continue;
    const existing = overridesByUser.get(override.userId) ?? [];
    existing.push({
      permission: override.permission as ThreadPermissionOverride["permission"],
      access: override.access
    });
    overridesByUser.set(override.userId, existing);
  }

  return Promise.all(members.map(async (member) => {
    const [canRead, canWrite, canEdit, canAdd, canRemove, canManage, canDelete] = await Promise.all([
      userHasConversationPermission(member.userId, conversationId, "channel_read"),
      userHasConversationPermission(member.userId, conversationId, "channel_write"),
      userHasConversationPermission(member.userId, conversationId, "channel_edit"),
      userHasConversationPermission(member.userId, conversationId, "channel_members_add"),
      userHasConversationPermission(member.userId, conversationId, "channel_members_remove"),
      userHasConversationPermission(member.userId, conversationId, "channel_manage_overrides"),
      userHasConversationPermission(member.userId, conversationId, "channel_delete")
    ]);

    return {
      user: {
        id: member.userId,
        name: member.name,
        displayName: member.displayName,
        username: member.username,
        email: member.email,
        bio: member.bio,
        role: member.role
      },
      role: member.memberRole,
      overrides: overridesByUser.get(member.userId) ?? [],
      effectivePermissions: {
        channel_read: canRead,
        channel_write: canWrite,
        channel_edit: canEdit,
        channel_members_add: canAdd,
        channel_members_remove: canRemove,
        channel_manage_overrides: canManage,
        channel_delete: canDelete
      }
    };
  }));
}

export async function addChannelMembers(
  userId: string,
  conversationId: string,
  input: AddChannelMembersInput
): Promise<ChannelMemberSummary[]> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support members");
  }
  await assertConversationMember(userId, conversationId);
  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    await assertConversationPermission(userId, conversationId, "channel_members_add");
  }

  const now = new Date();
  for (const member of input.members) {
    await ensureUserExists(member.userId);
    try {
      await db.insert(threadMembers)
        .values({
          conversationId,
          userId: member.userId,
          role: member.role ?? "member",
          createdAt: now,
          lastReadAt: null
        })
        .execute();
    } catch {
      // ignore duplicates
    }
    await setMemberOverrides(conversationId, member.userId, member.overrides);
  }

  return listChannelMembers(userId, conversationId);
}

export async function updateChannelMemberOverrides(
  userId: string,
  conversationId: string,
  memberId: string,
  input: UpdateChannelMemberOverridesInput
): Promise<ChannelMemberSummary> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support overrides");
  }

  await assertConversationMember(userId, conversationId);
  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    await assertConversationPermission(userId, conversationId, "channel_manage_overrides");
  }

  const memberRows = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, memberId)))
    .limit(1);
  const member = memberRows[0];
  if (!member) {
    throw new ApiError(404, "Member not found");
  }

  await setMemberOverrides(conversationId, memberId, input.overrides as ThreadPermissionOverride[]);

  const members = await listChannelMembers(userId, conversationId);
  const updated = members.find((entry) => entry.user.id === memberId);
  if (!updated) {
    throw new ApiError(404, "Member not found");
  }
  return updated;
}

export async function removeChannelMember(userId: string, conversationId: string, memberId: string): Promise<{ id: string }> {
  const conversation = await getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support members");
  }

  await assertConversationMember(userId, conversationId);
  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    await assertConversationPermission(userId, conversationId, "channel_members_remove");
  }

  await db.delete(threadMemberPermissions)
    .where(and(eq(threadMemberPermissions.conversationId, conversationId), eq(threadMemberPermissions.userId, memberId)))
    .execute();
  await db.delete(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, memberId)))
    .execute();

  return { id: memberId };
}






