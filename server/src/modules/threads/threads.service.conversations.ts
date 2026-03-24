import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  threadConversations,
  threadMemberPermissions,
  threadMembers,
  threadMessageDeletions,
  threadMessages,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertPermission } from "../../utils/permissions.js";
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
import { buildMessagePreview, getDmConversationRows, getThreadMentionCounts } from "./threads.service.data.js";
import type { AddChannelMembersInput, CreateChannelInput, UpdateChannelInput, UpdateChannelMemberOverridesInput } from "./threads.schema.js";

const CHANNEL_OVERRIDE_PERMISSIONS = new Set(["channel_read", "channel_write", "channel_edit", "channel_members_add", "channel_members_remove", "channel_manage_overrides", "channel_delete"]);

function normalizeChannelOverrides(overrides?: ThreadPermissionOverride[]): ThreadPermissionOverride[] {
  if (!overrides || overrides.length === 0) return [];
  const map = new Map<string, ThreadPermissionOverride>();
  for (const override of overrides) {
    if (!CHANNEL_OVERRIDE_PERMISSIONS.has(override.permission)) continue;
    map.set(override.permission, override);
  }
  return Array.from(map.values());
}

function setMemberOverrides(conversationId: string, userId: string, overrides?: ThreadPermissionOverride[]): void {
  const normalized = normalizeChannelOverrides(overrides);
  db.delete(threadMemberPermissions)
    .where(and(eq(threadMemberPermissions.conversationId, conversationId), eq(threadMemberPermissions.userId, userId)))
    .run();
  if (normalized.length === 0) return;
  const now = new Date();
  db.insert(threadMemberPermissions)
    .values(normalized.map((override) => ({
      conversationId,
      userId,
      permission: override.permission,
      access: override.access,
      createdAt: now
    })))
    .run();
}

export function listDmUsers(userId: string): ThreadUserSummary[] {
  assertPermission(userId, "dm_read");
  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role
    })
    .from(users)
    .orderBy(users.name)
    .all();
}

export function listDmConversations(userId: string): DmConversationSummary[] {
  assertPermission(userId, "dm_read");

  const rows = getDmConversationRows(userId);

  if (rows.length === 0) {
    return [];
  }

  const conversationIds = rows.map((row) => row.id);
  const mentionCounts = getThreadMentionCounts(userId, conversationIds);

  const summaries = rows.map((row) => {
    const otherMember = db
      .select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        username: users.username,
        email: users.email,
        role: users.role
      })
      .from(threadMembers)
      .innerJoin(users, eq(threadMembers.userId, users.id))
      .where(and(eq(threadMembers.conversationId, row.id), ne(threadMembers.userId, userId)))
      .limit(1)
      .get();

    const otherUser = otherMember ?? ensureUserExists(userId);

    const lastMessage = db
      .select({
        body: threadMessages.body,
        bodyEncrypted: threadMessages.bodyEncrypted,
        encryptionVersion: threadMessages.encryptionVersion,
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
      .limit(1)
      .get();

    const preview = lastMessage ? buildMessagePreview("dm", lastMessage) : null;
    const lastMessageAt = lastMessage?.createdAt ?? row.lastMessageAt ?? row.createdAt ?? null;

    return {
      id: row.id,
      type: "dm" as const,
      otherUser,
      lastMessageAt: lastMessageAt ?? null,
      lastMessagePreview: preview,
      unreadMentions: mentionCounts.get(row.id) ?? 0
    };
  });

  return summaries.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export function getOrCreateDmConversation(userId: string, otherUserId: string): DmConversationSummary {
  assertPermission(userId, "dm_write");
  const otherUser = ensureUserExists(otherUserId);

  const existingMemberships = db
    .select({ conversationId: threadMembers.conversationId })
    .from(threadMembers)
    .where(eq(threadMembers.userId, userId))
    .all();

  const candidateIds = existingMemberships.map((row) => row.conversationId);
  let existingId: string | null = null;

  if (candidateIds.length > 0) {
    if (userId === otherUserId) {
      for (const id of candidateIds) {
        const conversation = db
          .select({ id: threadConversations.id })
          .from(threadConversations)
          .where(and(eq(threadConversations.id, id), eq(threadConversations.type, "dm")))
          .get();
        if (!conversation) continue;
        const countRow = db
          .select({ count: sql<number>`count(*)` })
          .from(threadMembers)
          .where(eq(threadMembers.conversationId, id))
          .get();
        if ((countRow?.count ?? 0) === 1) {
          existingId = id;
          break;
        }
      }
    } else {
      const otherMemberships = db
        .select({ conversationId: threadMembers.conversationId })
        .from(threadMembers)
        .where(and(inArray(threadMembers.conversationId, candidateIds), eq(threadMembers.userId, otherUserId)))
        .all()
        .map((row) => row.conversationId);

      for (const id of otherMemberships) {
        const conversation = db
          .select({ id: threadConversations.id })
          .from(threadConversations)
          .where(and(eq(threadConversations.id, id), eq(threadConversations.type, "dm")))
          .get();
        if (!conversation) continue;
        const countRow = db
          .select({ count: sql<number>`count(*)` })
          .from(threadMembers)
          .where(eq(threadMembers.conversationId, id))
          .get();
        if ((countRow?.count ?? 0) <= 2) {
          existingId = id;
          break;
        }
      }
    }
  }

  if (existingId) {
    const summaries = listDmConversations(userId);
    const existingSummary = summaries.find((summary) => summary.id === existingId);
    if (existingSummary) {
      return existingSummary;
    }
  }

  const now = new Date();
  const conversationId = crypto.randomUUID();
  db.insert(threadConversations)
    .values({
      id: conversationId,
      type: "dm",
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null
    })
    .run();

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

  db.insert(threadMembers)
    .values(members)
    .run();

  return {
    id: conversationId,
    type: "dm",
    otherUser: otherUser ?? ensureUserExists(userId),
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadMentions: 0
  };
}

export function listChannelConversations(userId: string): ChannelConversationSummary[] {
  const rows = db
    .select({
      id: threadConversations.id,
      name: threadConversations.name,
      description: threadConversations.description,
      createdBy: threadConversations.createdBy,
      lastMessageAt: threadConversations.lastMessageAt,
      createdAt: threadConversations.createdAt
    })
    .from(threadMembers)
    .innerJoin(threadConversations, eq(threadMembers.conversationId, threadConversations.id))
    .where(and(eq(threadMembers.userId, userId), eq(threadConversations.type, "channel")))
    .all();

  if (rows.length === 0) {
    return [];
  }

  const permittedRows = rows.filter((row) => userHasConversationPermission(userId, row.id, "channel_read"));
  if (permittedRows.length === 0) {
    return [];
  }

  const conversationIds = permittedRows.map((row) => row.id);
  const mentionCounts = getThreadMentionCounts(userId, conversationIds);

  const memberCounts = db
    .select({ conversationId: threadMembers.conversationId, count: sql<number>`count(*)` })
    .from(threadMembers)
    .where(inArray(threadMembers.conversationId, conversationIds))
    .groupBy(threadMembers.conversationId)
    .all();
  const memberCountById = new Map(memberCounts.map((row) => [row.conversationId, row.count]));

  const summaries = permittedRows.map((row) => {
    const lastMessage = db
      .select({
        body: threadMessages.body,
        bodyEncrypted: threadMessages.bodyEncrypted,
        encryptionVersion: threadMessages.encryptionVersion,
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
      .limit(1)
      .get();

    const preview = lastMessage ? buildMessagePreview("channel", lastMessage) : null;
    const lastMessageAt = lastMessage?.createdAt ?? row.lastMessageAt ?? row.createdAt ?? null;

    return {
      id: row.id,
      type: "channel" as const,
      name: row.name ?? "Untitled channel",
      description: row.description ?? null,
      createdById: row.createdBy ?? null,
      lastMessageAt: lastMessageAt ?? null,
      lastMessagePreview: preview,
      unreadMentions: mentionCounts.get(row.id) ?? 0,
      memberCount: memberCountById.get(row.id) ?? 0
    };
  });

  return summaries.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });
}

export function createChannelConversation(userId: string, input: CreateChannelInput): ChannelConversationSummary {
  assertPermission(userId, "channel_write");

  const now = new Date();
  const conversationId = crypto.randomUUID();
  const name = input.name.trim();
  const description = input.description?.trim();
  const normalizedDescription = description && description.length > 0 ? description : null;

  db.insert(threadConversations)
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
    .run();

  db.insert(threadMembers)
    .values({
      conversationId,
      userId,
      role: "admin",
      createdAt: now,
      lastReadAt: null
    })
    .run();

  const members = input.members ?? [];
  for (const member of members) {
    if (member.userId === userId) {
      continue;
    }
    ensureUserExists(member.userId);
    try {
      db.insert(threadMembers)
        .values({
          conversationId,
          userId: member.userId,
          role: member.role ?? "member",
          createdAt: now,
          lastReadAt: null
        })
        .run();
    } catch {
      // ignore duplicates
    }
    setMemberOverrides(conversationId, member.userId, member.overrides);
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
    memberCount: 1 + members.filter((member) => member.userId !== userId).length
  };
}

export function updateChannelConversation(
  userId: string,
  conversationId: string,
  input: UpdateChannelInput
): ChannelConversationSummary {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations can be updated");
  }


  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    assertConversationPermission(userId, conversationId, "channel_edit");
  }

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    updates.name = input.name.trim();
  }
  if (input.description !== undefined) {
    const trimmed = input.description?.trim() ?? "";
    updates.description = trimmed.length > 0 ? trimmed : null;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = new Date();
    db.update(threadConversations)
      .set(updates)
      .where(eq(threadConversations.id, conversationId))
      .run();
  }

  const summaries = listChannelConversations(userId);
  const updated = summaries.find((summary) => summary.id === conversationId);
  if (!updated) {
    throw new ApiError(404, "Channel not found");
  }
  return updated;
}

export function leaveChannelConversation(userId: string, conversationId: string): { id: string } {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations can be left");
  }

  assertConversationMember(userId, conversationId);

  db.delete(threadMemberPermissions)
    .where(and(eq(threadMemberPermissions.conversationId, conversationId), eq(threadMemberPermissions.userId, userId)))
    .run();
  db.delete(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .run();

  return { id: conversationId };
}

export function deleteChannelConversation(userId: string, conversationId: string): { id: string } {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations can be deleted");
  }

  const isCreator = conversation.createdBy === userId;
  if (!isCreator && !userHasConversationPermission(userId, conversationId, "channel_delete")) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
  if (!isCreator) {
    assertConversationMember(userId, conversationId);
  }

  const uploadsRoot = path.resolve(process.cwd(), "uploads", "threads", conversationId);
  void fs.rm(uploadsRoot, { recursive: true, force: true }).catch(() => {});

  db.delete(threadConversations)
    .where(eq(threadConversations.id, conversationId))
    .run();

  return { id: conversationId };
}
export function listChannelMembers(userId: string, conversationId: string): ChannelMemberSummary[] {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support member listing");
  }

  assertConversationMember(userId, conversationId);
  assertConversationPermission(userId, conversationId, "channel_read");

  const members = db
    .select({
      userId: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role,
      memberRole: threadMembers.role
    })
    .from(threadMembers)
    .innerJoin(users, eq(threadMembers.userId, users.id))
    .where(eq(threadMembers.conversationId, conversationId))
    .orderBy(users.name)
    .all();

  const overrides = db
    .select({
      userId: threadMemberPermissions.userId,
      permission: threadMemberPermissions.permission,
      access: threadMemberPermissions.access
    })
    .from(threadMemberPermissions)
    .where(eq(threadMemberPermissions.conversationId, conversationId))
    .all();

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

  return members.map((member) => ({
    user: {
      id: member.userId,
      name: member.name,
      displayName: member.displayName,
      username: member.username,
      email: member.email,
      role: member.role
    },
    role: member.memberRole,
    overrides: overridesByUser.get(member.userId) ?? [],
    effectivePermissions: {
      channel_read: userHasConversationPermission(member.userId, conversationId, "channel_read"),
      channel_write: userHasConversationPermission(member.userId, conversationId, "channel_write"),
      channel_edit: userHasConversationPermission(member.userId, conversationId, "channel_edit"),
      channel_members_add: userHasConversationPermission(member.userId, conversationId, "channel_members_add"),
      channel_members_remove: userHasConversationPermission(member.userId, conversationId, "channel_members_remove"),
      channel_manage_overrides: userHasConversationPermission(member.userId, conversationId, "channel_manage_overrides"),
      channel_delete: userHasConversationPermission(member.userId, conversationId, "channel_delete")
    }
  }));
}

export function addChannelMembers(
  userId: string,
  conversationId: string,
  input: AddChannelMembersInput
): ChannelMemberSummary[] {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support members");
  }
  assertConversationMember(userId, conversationId);
  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    assertConversationPermission(userId, conversationId, "channel_members_add");
  }

  const now = new Date();
  for (const member of input.members) {
    ensureUserExists(member.userId);
    try {
      db.insert(threadMembers)
        .values({
          conversationId,
          userId: member.userId,
          role: member.role ?? "member",
          createdAt: now,
          lastReadAt: null
        })
        .run();
    } catch {
      // ignore duplicates
    }
    setMemberOverrides(conversationId, member.userId, member.overrides);
  }

  return listChannelMembers(userId, conversationId);
}

export function updateChannelMemberOverrides(
  userId: string,
  conversationId: string,
  memberId: string,
  input: UpdateChannelMemberOverridesInput
): ChannelMemberSummary {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support overrides");
  }

  assertConversationMember(userId, conversationId);
  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    assertConversationPermission(userId, conversationId, "channel_manage_overrides");
  }

  const member = db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, memberId)))
    .get();
  if (!member) {
    throw new ApiError(404, "Member not found");
  }

  setMemberOverrides(conversationId, memberId, input.overrides as ThreadPermissionOverride[]);

  const members = listChannelMembers(userId, conversationId);
  const updated = members.find((entry) => entry.user.id === memberId);
  if (!updated) {
    throw new ApiError(404, "Member not found");
  }
  return updated;
}

export function removeChannelMember(userId: string, conversationId: string, memberId: string): { id: string } {
  const conversation = getConversation(conversationId);
  if (conversation.type !== "channel") {
    throw new ApiError(400, "Only channel conversations support members");
  }

  assertConversationMember(userId, conversationId);
  const isCreator = conversation.createdBy === userId;
  if (!isCreator) {
    assertConversationPermission(userId, conversationId, "channel_members_remove");
  }

  db.delete(threadMemberPermissions)
    .where(and(eq(threadMemberPermissions.conversationId, conversationId), eq(threadMemberPermissions.userId, memberId)))
    .run();
  db.delete(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, memberId)))
    .run();

  return { id: memberId };
}







