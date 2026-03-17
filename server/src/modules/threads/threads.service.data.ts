import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  threadAttachments,
  threadConversations,
  threadMembers,
  threadMessageDeletions,
  threadMessageReactions,
  threadMessages,
  threadMentions,
  threadReplyReactions,
  threadReplyMentions,
  threadReplies,
  threadVoiceNotes,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody } from "../../utils/encryption.js";
import type { ThreadAttachment, ThreadReaction, ThreadVoiceNote } from "./threads.service.types.js";

export function getThreadMessageDeletionSet(userId: string, messageIds: string[]): Set<string> {
  if (messageIds.length === 0) {
    return new Set();
  }

  const rows = db
    .select({ messageId: threadMessageDeletions.messageId })
    .from(threadMessageDeletions)
    .where(and(eq(threadMessageDeletions.userId, userId), inArray(threadMessageDeletions.messageId, messageIds)))
    .all();

  return new Set(rows.map((row) => row.messageId));
}

export function getThreadMessageReactions(messageIds: string[]): Map<string, ThreadReaction[]> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      messageId: threadMessageReactions.messageId,
      emoji: threadMessageReactions.emoji,
      count: sql<number>`count(*)`
    })
    .from(threadMessageReactions)
    .where(inArray(threadMessageReactions.messageId, messageIds))
    .groupBy(threadMessageReactions.messageId, threadMessageReactions.emoji)
    .all();

  const map = new Map<string, ThreadReaction[]>();
  for (const row of rows) {
    const existing = map.get(row.messageId) ?? [];
    existing.push({ emoji: row.emoji, count: row.count });
    map.set(row.messageId, existing);
  }
  return map;
}

export function getThreadReplyReactions(replyIds: string[]): Map<string, ThreadReaction[]> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      replyId: threadReplyReactions.replyId,
      emoji: threadReplyReactions.emoji,
      count: sql<number>`count(*)`
    })
    .from(threadReplyReactions)
    .where(inArray(threadReplyReactions.replyId, replyIds))
    .groupBy(threadReplyReactions.replyId, threadReplyReactions.emoji)
    .all();

  const map = new Map<string, ThreadReaction[]>();
  for (const row of rows) {
    const existing = map.get(row.replyId) ?? [];
    existing.push({ emoji: row.emoji, count: row.count });
    map.set(row.replyId, existing);
  }
  return map;
}

export function getThreadReplyCounts(messageIds: string[]): Map<string, number> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      parentMessageId: threadReplies.parentMessageId,
      count: sql<number>`count(*)`
    })
    .from(threadReplies)
    .where(and(inArray(threadReplies.parentMessageId, messageIds), isNull(threadReplies.deletedAt)))
    .groupBy(threadReplies.parentMessageId)
    .all();

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.parentMessageId, row.count);
  }
  return map;
}

export function getThreadAttachmentsForMessages(messageIds: string[]): Map<string, ThreadAttachment[]> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = db
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
    .orderBy(threadAttachments.createdAt)
    .all();

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

export function getThreadVoiceNotesForMessages(messageIds: string[]): Map<string, ThreadVoiceNote> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      id: threadVoiceNotes.id,
      messageId: threadVoiceNotes.messageId,
      durationSec: threadVoiceNotes.durationSec,
      createdAt: threadVoiceNotes.createdAt
    })
    .from(threadVoiceNotes)
    .where(inArray(threadVoiceNotes.messageId, messageIds))
    .all();

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

export function getThreadAttachmentRecord(attachmentId: string) {
  const row = db
    .select({
      id: threadAttachments.id,
      messageId: threadAttachments.messageId,
      originalName: threadAttachments.originalName,
      storagePath: threadAttachments.storagePath
    })
    .from(threadAttachments)
    .where(eq(threadAttachments.id, attachmentId))
    .get();

  if (!row) {
    throw new ApiError(404, "Attachment not found");
  }

  return row;
}

export function getThreadVoiceNoteRecord(voiceNoteId: string) {
  const row = db
    .select({
      id: threadVoiceNotes.id,
      messageId: threadVoiceNotes.messageId,
      storagePath: threadVoiceNotes.storagePath
    })
    .from(threadVoiceNotes)
    .where(eq(threadVoiceNotes.id, voiceNoteId))
    .get();

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

export function getThreadUsersByIds(userIds: string[]) {
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
      role: users.role
    })
    .from(users)
    .where(inArray(users.id, userIds))
    .all();
}

export function getThreadConversationMemberIds(conversationId: string, userIds: string[]): string[] {
  if (userIds.length === 0) {
    return [];
  }

  return db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), inArray(threadMembers.userId, userIds)))
    .all()
    .map((row) => row.userId);
}

export function getDmConversationRows(userId: string) {
  return db
    .select({
      id: threadConversations.id,
      lastMessageAt: threadConversations.lastMessageAt,
      createdAt: threadConversations.createdAt
    })
    .from(threadMembers)
    .innerJoin(threadConversations, eq(threadMembers.conversationId, threadConversations.id))
    .where(and(eq(threadMembers.userId, userId), eq(threadConversations.type, "dm")))
    .all();
}

export function getThreadMentionCounts(userId: string, conversationIds: string[]) {
  if (conversationIds.length === 0) {
    return new Map<string, number>();
  }

  const mentionCounts = new Map<string, number>();
  const messageMentionRows = db
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
    .groupBy(threadMessages.conversationId)
    .all();

  for (const row of messageMentionRows) {
    mentionCounts.set(row.conversationId, row.count);
  }

  const replyMentionRows = db
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
    .groupBy(threadMessages.conversationId)
    .all();

  for (const row of replyMentionRows) {
    mentionCounts.set(row.conversationId, (mentionCounts.get(row.conversationId) ?? 0) + row.count);
  }

  return mentionCounts;
}

