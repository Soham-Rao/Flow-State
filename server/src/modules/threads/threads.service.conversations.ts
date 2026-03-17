import crypto from "node:crypto";

import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { threadConversations, threadMembers, threadMessageDeletions, threadMessages, users } from "../../db/schema.js";
import { assertPermission } from "../../utils/permissions.js";
import type { DmConversationSummary, ThreadUserSummary } from "./threads.service.types.js";
import { ensureUserExists } from "./threads.service.access.js";
import { buildMessagePreview, getDmConversationRows, getThreadMentionCounts } from "./threads.service.data.js";

export function listDmUsers(): ThreadUserSummary[] {
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
