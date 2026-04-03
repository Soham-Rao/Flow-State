import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  threadAttachments,
  threadConversations,
  threadMembers,
  threadMessageDeletions,
  threadReplyDeletions,
  threadMessageReactions,
  threadMessages,
  threadMentions,
  threadReplyReactions,
  threadReplyMentions,
  threadReplyAttachments,
  threadReplyVoiceNotes,
  threadReplies,
  threadVoiceNotes,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody } from "../../utils/encryption.js";
import type { ThreadAttachment, ThreadReaction, ThreadVoiceNote, ThreadReplyAttachment, ThreadReplyVoiceNote, ThreadUserSummary } from "./threads.service.types.js";


export async function getThreadReplyDeletionSet(userId: string, replyIds: string[]): Promise<Set<string>> {
  if (replyIds.length === 0) {
    return new Set();
  }

  const rows: Array<{ replyId: string }> = await db
    .select({ replyId: threadReplyDeletions.replyId })
    .from(threadReplyDeletions)
    .where(and(eq(threadReplyDeletions.userId, userId), inArray(threadReplyDeletions.replyId, replyIds)));

  return new Set(rows.map((row) => row.replyId));
}

export async function getThreadMessageDeletionSet(userId: string, messageIds: string[]): Promise<Set<string>> {
  if (messageIds.length === 0) {
    return new Set();
  }

  const rows: Array<{ messageId: string }> = await db
    .select({ messageId: threadMessageDeletions.messageId })
    .from(threadMessageDeletions)
    .where(and(eq(threadMessageDeletions.userId, userId), inArray(threadMessageDeletions.messageId, messageIds)));

  return new Set(rows.map((row) => row.messageId));
}

export async function getThreadMessageReactions(messageIds: string[]): Promise<Map<string, ThreadReaction[]>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ messageId: string; emoji: string; count: number }> = await db
    .select({
      messageId: threadMessageReactions.messageId,
      emoji: threadMessageReactions.emoji,
      count: sql<number>`count(*)`
    })
    .from(threadMessageReactions)
    .where(inArray(threadMessageReactions.messageId, messageIds))
    .groupBy(threadMessageReactions.messageId, threadMessageReactions.emoji);

  const map = new Map<string, ThreadReaction[]>();
  for (const row of rows) {
    const existing = map.get(row.messageId) ?? [];
    existing.push({ emoji: row.emoji, count: row.count });
    map.set(row.messageId, existing);
  }
  return map;
}

export async function getThreadReplyReactions(replyIds: string[]): Promise<Map<string, ThreadReaction[]>> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ replyId: string; emoji: string; count: number }> = await db
    .select({
      replyId: threadReplyReactions.replyId,
      emoji: threadReplyReactions.emoji,
      count: sql<number>`count(*)`
    })
    .from(threadReplyReactions)
    .where(inArray(threadReplyReactions.replyId, replyIds))
    .groupBy(threadReplyReactions.replyId, threadReplyReactions.emoji);

  const map = new Map<string, ThreadReaction[]>();
  for (const row of rows) {
    const existing = map.get(row.replyId) ?? [];
    existing.push({ emoji: row.emoji, count: row.count });
    map.set(row.replyId, existing);
  }
  return map;
}

export async function getThreadReplyCounts(messageIds: string[], userId?: string): Promise<Map<string, number>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const query = userId
    ? db
        .select({
          parentMessageId: threadReplies.parentMessageId,
          count: sql<number>`count(*)`
        })
        .from(threadReplies)
        .leftJoin(
          threadReplyDeletions,
          and(eq(threadReplyDeletions.replyId, threadReplies.id), eq(threadReplyDeletions.userId, userId))
        )
        .where(
          and(
            inArray(threadReplies.parentMessageId, messageIds),
            isNull(threadReplies.deletedAt),
            isNull(threadReplyDeletions.replyId)
          )
        )
    : db
        .select({
          parentMessageId: threadReplies.parentMessageId,
          count: sql<number>`count(*)`
        })
        .from(threadReplies)
        .where(and(inArray(threadReplies.parentMessageId, messageIds), isNull(threadReplies.deletedAt)));

  const rows: Array<{ parentMessageId: string; count: number }> = await query.groupBy(threadReplies.parentMessageId);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.parentMessageId, row.count);
  }
  return map;
}
export async function getThreadReplyMentionCounts(messageIds: string[], userId: string): Promise<Map<string, number>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ parentMessageId: string; count: number }> = await db
    .select({
      parentMessageId: threadReplies.parentMessageId,
      count: sql<number>`count(*)`
    })
    .from(threadReplyMentions)
    .innerJoin(threadReplies, eq(threadReplyMentions.replyId, threadReplies.id))
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .innerJoin(threadMembers, and(
      eq(threadMembers.conversationId, threadMessages.conversationId),
      eq(threadMembers.userId, threadReplyMentions.mentionedUserId)
    ))
    .where(
      and(
        inArray(threadReplies.parentMessageId, messageIds),
        eq(threadReplyMentions.mentionedUserId, userId),
        isNull(threadReplyMentions.seenAt),
        ne(threadReplies.authorId, threadReplyMentions.mentionedUserId)
      )
    )
    .groupBy(threadReplies.parentMessageId);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.parentMessageId, row.count);
  }
  return map;
}


export async function getThreadAttachmentsForMessages(messageIds: string[]): Promise<Map<string, ThreadAttachment[]>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ id: string; messageId: string; originalName: string; mimeType: string | null; size: number; createdAt: Date }> = await db
    .select({
      id: threadAttachments.id,
      messageId: threadAttachments.messageId,
      originalName: threadAttachments.originalName,
      mimeType: threadAttachments.mimeType,
      size: threadAttachments.size,
      createdAt: threadAttachments.createdAt
    })
    .from(threadAttachments)
    .where(inArray(threadAttachments.messageId, messageIds))
    .orderBy(threadAttachments.createdAt);

  const map = new Map<string, ThreadAttachment[]>();
  for (const row of rows) {
    const existing = map.get(row.messageId) ?? [];
    existing.push({
      id: row.id,
      messageId: row.messageId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt
    });
    map.set(row.messageId, existing);
  }
  return map;
}

export async function getThreadVoiceNotesForMessages(messageIds: string[]): Promise<Map<string, ThreadVoiceNote>> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ id: string; messageId: string; durationSec: number; createdAt: Date }> = await db
    .select({
      id: threadVoiceNotes.id,
      messageId: threadVoiceNotes.messageId,
      durationSec: threadVoiceNotes.durationSec,
      createdAt: threadVoiceNotes.createdAt
    })
    .from(threadVoiceNotes)
    .where(inArray(threadVoiceNotes.messageId, messageIds));

  const map = new Map<string, ThreadVoiceNote>();
  for (const row of rows) {
    map.set(row.messageId, {
      id: row.id,
      messageId: row.messageId,
      durationSec: row.durationSec,
      createdAt: row.createdAt
    });
  }
  return map;
}


export async function getThreadAttachmentsForReplies(replyIds: string[]): Promise<Map<string, ThreadReplyAttachment[]>> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ id: string; replyId: string; originalName: string; mimeType: string | null; size: number; createdAt: Date }> = await db
    .select({
      id: threadReplyAttachments.id,
      replyId: threadReplyAttachments.replyId,
      originalName: threadReplyAttachments.originalName,
      mimeType: threadReplyAttachments.mimeType,
      size: threadReplyAttachments.size,
      createdAt: threadReplyAttachments.createdAt
    })
    .from(threadReplyAttachments)
    .where(inArray(threadReplyAttachments.replyId, replyIds))
    .orderBy(threadReplyAttachments.createdAt);

  const map = new Map<string, ThreadReplyAttachment[]>();
  for (const row of rows) {
    const existing = map.get(row.replyId) ?? [];
    existing.push({
      id: row.id,
      replyId: row.replyId,
      originalName: row.originalName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: row.createdAt
    });
    map.set(row.replyId, existing);
  }
  return map;
}

export async function getThreadVoiceNotesForReplies(replyIds: string[]): Promise<Map<string, ThreadReplyVoiceNote>> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const rows: Array<{ id: string; replyId: string; durationSec: number; createdAt: Date }> = await db
    .select({
      id: threadReplyVoiceNotes.id,
      replyId: threadReplyVoiceNotes.replyId,
      durationSec: threadReplyVoiceNotes.durationSec,
      createdAt: threadReplyVoiceNotes.createdAt
    })
    .from(threadReplyVoiceNotes)
    .where(inArray(threadReplyVoiceNotes.replyId, replyIds));

  const map = new Map<string, ThreadReplyVoiceNote>();
  for (const row of rows) {
    map.set(row.replyId, {
      id: row.id,
      replyId: row.replyId,
      durationSec: row.durationSec,
      createdAt: row.createdAt
    });
  }
  return map;
}

export async function getThreadReplyAttachmentRecord(attachmentId: string): Promise<{ id: string; replyId: string; originalName: string; storagePath: string }> {
  const rows: Array<{ id: string; replyId: string; originalName: string; storagePath: string }> = await db
    .select({
      id: threadReplyAttachments.id,
      replyId: threadReplyAttachments.replyId,
      originalName: threadReplyAttachments.originalName,
      storagePath: threadReplyAttachments.storagePath
    })
    .from(threadReplyAttachments)
    .where(eq(threadReplyAttachments.id, attachmentId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Attachment not found");
  }

  return row;
}

export async function getThreadReplyVoiceNoteRecord(voiceNoteId: string): Promise<{ id: string; replyId: string; storagePath: string }> {
  const rows: Array<{ id: string; replyId: string; storagePath: string }> = await db
    .select({
      id: threadReplyVoiceNotes.id,
      replyId: threadReplyVoiceNotes.replyId,
      storagePath: threadReplyVoiceNotes.storagePath
    })
    .from(threadReplyVoiceNotes)
    .where(eq(threadReplyVoiceNotes.id, voiceNoteId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Voice message not found");
  }

  return row;
}

export async function getThreadAttachmentRecord(attachmentId: string): Promise<{ id: string; messageId: string; originalName: string; storagePath: string }> {
  const rows: Array<{ id: string; messageId: string; originalName: string; storagePath: string }> = await db
    .select({
      id: threadAttachments.id,
      messageId: threadAttachments.messageId,
      originalName: threadAttachments.originalName,
      storagePath: threadAttachments.storagePath
    })
    .from(threadAttachments)
    .where(eq(threadAttachments.id, attachmentId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Attachment not found");
  }

  return row;
}

export async function getThreadVoiceNoteRecord(voiceNoteId: string): Promise<{ id: string; messageId: string; storagePath: string }> {
  const rows: Array<{ id: string; messageId: string; storagePath: string }> = await db
    .select({
      id: threadVoiceNotes.id,
      messageId: threadVoiceNotes.messageId,
      storagePath: threadVoiceNotes.storagePath
    })
    .from(threadVoiceNotes)
    .where(eq(threadVoiceNotes.id, voiceNoteId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Voice message not found");
  }

  return row;
}

export function buildMessagePreview(
  conversationType: "dm" | "channel",
  row: { body: string | null; bodyEncrypted: string | null; encryptionVersion: number; deletedAt: Date | null; }
): string | null {
  if (row.deletedAt) {
    return "This message was deleted.";
  }
  if (conversationType === "dm" && row.bodyEncrypted) {
    return decryptDmBody(row.bodyEncrypted, row.encryptionVersion);
  }
  if (row.body) {
    return row.body;
  }
  return "Attachment";
}

export function getThreadReactionUsers(reactionRow: { userId: string }[]): { userId: string }[] {
  return reactionRow;
}

export async function getThreadUsersByIds(userIds: string[]): Promise<ThreadUserSummary[]> {
  if (userIds.length === 0) {
    return [];
  }
  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role,
      bio: users.bio
    })
    .from(users)
    .where(inArray(users.id, userIds));
}

export async function getThreadConversationMemberIds(conversationId: string, userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) {
    return [];
  }

  const rows: Array<{ userId: string }> = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), inArray(threadMembers.userId, userIds)));

  return rows.map((row) => row.userId);
}

export async function getDmConversationRows(userId: string): Promise<Array<{ id: string; lastMessageAt: Date | null; createdAt: Date; lastReadAt: Date | null }>> {
  return db
    .select({
      id: threadConversations.id,
      lastMessageAt: threadConversations.lastMessageAt,
      createdAt: threadConversations.createdAt,
      lastReadAt: threadMembers.lastReadAt
    })
    .from(threadMembers)
    .innerJoin(threadConversations, eq(threadMembers.conversationId, threadConversations.id))
    .where(and(eq(threadMembers.userId, userId), eq(threadConversations.type, "dm")));
}

export async function getThreadMessageMentionCounts(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (conversationIds.length === 0) {
    return new Map<string, number>();
  }

  const mentionCounts = new Map<string, number>();
  const messageMentionRows = await db
    .select({
      conversationId: threadMessages.conversationId,
      count: sql<number>`count(*)`
    })
    .from(threadMentions)
    .innerJoin(threadMessages, eq(threadMentions.messageId, threadMessages.id))
    .innerJoin(threadMembers, and(
      eq(threadMembers.conversationId, threadMessages.conversationId),
      eq(threadMembers.userId, threadMentions.mentionedUserId)
    ))
    .where(
      and(
        eq(threadMentions.mentionedUserId, userId),
        isNull(threadMentions.seenAt),
        ne(threadMessages.authorId, threadMentions.mentionedUserId),
        inArray(threadMessages.conversationId, conversationIds)
      )
    )
    .groupBy(threadMessages.conversationId);

  for (const row of messageMentionRows) {
    mentionCounts.set(row.conversationId, row.count);
  }

  return mentionCounts;
}

export async function getThreadReplyMentionCountsByConversation(userId: string, conversationIds: string[]): Promise<Map<string, number>> {
  if (conversationIds.length === 0) {
    return new Map<string, number>();
  }

  const mentionCounts = new Map<string, number>();
  const replyMentionRows = await db
    .select({
      conversationId: threadMessages.conversationId,
      count: sql<number>`count(*)`
    })
    .from(threadReplyMentions)
    .innerJoin(threadReplies, eq(threadReplyMentions.replyId, threadReplies.id))
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .innerJoin(threadMembers, and(
      eq(threadMembers.conversationId, threadMessages.conversationId),
      eq(threadMembers.userId, threadReplyMentions.mentionedUserId)
    ))
    .where(
      and(
        eq(threadReplyMentions.mentionedUserId, userId),
        isNull(threadReplyMentions.seenAt),
        ne(threadReplies.authorId, threadReplyMentions.mentionedUserId),
        inArray(threadMessages.conversationId, conversationIds)
      )
    )
    .groupBy(threadMessages.conversationId);

  for (const row of replyMentionRows) {
    mentionCounts.set(row.conversationId, row.count);
  }

  return mentionCounts;
}

