import crypto from "node:crypto";
import fs from "node:fs/promises";

import { and, desc, eq, isNull, lt, ne } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  threadAttachments,
  threadConversations,
  threadMembers,
  threadMessageDeletions,
  threadMessageReactions,
  threadMessages,
  threadMentions,
  threadVoiceNotes,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody, encryptDmBody } from "../../utils/encryption.js";
import type {
  CreateThreadMessageInput,
  DeleteThreadMessageInput,
  ThreadMessageListParams,
  UpdateThreadMessageInput
} from "./threads.schema.js";
import type { ThreadMessageSummary, ThreadReactionDetail, ThreadUserSummary } from "./threads.service.types.js";
import { assertConversationMember, assertConversationPermission, ensureUserExists, getConversation } from "./threads.service.access.js";
import { storeThreadMentions } from "./threads.service.mentions.js";
import {
  getThreadAttachmentsForMessages,
  getThreadMessageDeletionSet,
  getThreadMessageReactions,
  getThreadReplyCounts,
  getThreadVoiceNotesForMessages
} from "./threads.service.data.js";
import { resolveThreadAttachmentPath, resolveThreadVoiceNotePath } from "./threads.service.storage.js";

export function listThreadMessages(
  userId: string,
  conversationId: string,
  params: ThreadMessageListParams = {}
): ThreadMessageSummary[] {
  const conversation = getConversation(conversationId);
  assertConversationMember(userId, conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, conversationId, "dm_read");
  } else {
    assertConversationPermission(userId, conversationId, "channel_read");
    throw new ApiError(400, "Channels are not available yet");
  }

  const limit = params.limit ?? 50;
  const conditions = [eq(threadMessages.conversationId, conversationId)];
  if (params.cursor) {
    conditions.push(lt(threadMessages.createdAt, new Date(params.cursor)));
  }

  const rows = db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      body: threadMessages.body,
      bodyEncrypted: threadMessages.bodyEncrypted,
      encryptionVersion: threadMessages.encryptionVersion,
      isForwarded: threadMessages.isForwarded,
      createdAt: threadMessages.createdAt,
      updatedAt: threadMessages.updatedAt,
      deletedAt: threadMessages.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role
    })
    .from(threadMessages)
    .innerJoin(users, eq(threadMessages.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(threadMessages.createdAt))
    .limit(limit)
    .all();

  const now = new Date();
  db.update(threadMembers)
    .set({ lastReadAt: now })
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .run();

  const messageIds = rows.map((row) => row.id);
  const deletedForUser = getThreadMessageDeletionSet(userId, messageIds);
  const filteredRows = rows.filter((row) => !(row.deletedAt === null && deletedForUser.has(row.id)));
  const visibleIds = filteredRows.map((row) => row.id);
  const reactionsByMessageId = getThreadMessageReactions(visibleIds);
  const replyCounts = getThreadReplyCounts(visibleIds);
  const attachmentsByMessageId = getThreadAttachmentsForMessages(visibleIds);
  const voiceNotesByMessageId = getThreadVoiceNotesForMessages(visibleIds);

  const summaries = filteredRows.map((row) => {
    const isDeleted = Boolean(row.deletedAt);
    let body = row.body;
    if (isDeleted) {
      body = "This message was deleted.";
    } else if (conversation.type === "dm" && row.bodyEncrypted) {
      body = decryptDmBody(row.bodyEncrypted, row.encryptionVersion);
    }
    return {
      id: row.id,
      conversationId: row.conversationId,
      author: {
        id: row.authorId,
        name: row.authorName,
        displayName: row.authorDisplayName,
        username: row.authorUsername,
        email: row.authorEmail,
        role: row.authorRole
      },
      body,
      isForwarded: Boolean(row.isForwarded),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      reactions: isDeleted ? [] : reactionsByMessageId.get(row.id) ?? [],
      replyCount: isDeleted ? 0 : replyCounts.get(row.id) ?? 0,
      attachments: isDeleted ? [] : attachmentsByMessageId.get(row.id) ?? [],
      voiceNote: isDeleted ? null : voiceNotesByMessageId.get(row.id) ?? null
    };
  });

  return summaries.reverse();
}

export function listThreadMessageReactionDetails(userId: string, messageId: string): ThreadReactionDetail[] {
  const message = db
    .select({ id: threadMessages.id, conversationId: threadMessages.conversationId, deletedAt: threadMessages.deletedAt })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .get();

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (message.deletedAt) {
    return [];
  }

  const conversation = getConversation(message.conversationId);
  assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, message.conversationId, "dm_read");
  } else {
    assertConversationPermission(userId, message.conversationId, "channel_read");
    throw new ApiError(400, "Channels are not available yet");
  }

  const rows = db
    .select({
      emoji: threadMessageReactions.emoji,
      userId: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role
    })
    .from(threadMessageReactions)
    .innerJoin(users, eq(threadMessageReactions.userId, users.id))
    .where(eq(threadMessageReactions.messageId, messageId))
    .all();

  const map = new Map<string, ThreadUserSummary[]>();
  for (const row of rows) {
    const existing = map.get(row.emoji) ?? [];
    existing.push({
      id: row.userId,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      role: row.role
    });
    map.set(row.emoji, existing);
  }

  return Array.from(map.entries()).map(([emoji, users]) => ({ emoji, users }));
}

export function createThreadMessage(userId: string, conversationId: string, input: CreateThreadMessageInput): ThreadMessageSummary {
  const conversation = getConversation(conversationId);
  assertConversationMember(userId, conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, conversationId, "dm_write");
  } else {
    assertConversationPermission(userId, conversationId, "channel_write");
    throw new ApiError(400, "Channels are not available yet");
  }

  const trimmed = input.body.trim();
  const hasAttachments = Boolean(input.hasAttachments);
  const hasVoiceNote = Boolean(input.hasVoiceNote);
  if (!trimmed && !hasAttachments && !hasVoiceNote) {
    throw new ApiError(400, "Message body cannot be empty");
  }

  let body: string | null = trimmed || null;
  let bodyEncrypted: string | null = null;
  let encryptionVersion = 1;

  if (conversation.type === "dm" && trimmed) {
    const encrypted = encryptDmBody(trimmed);
    bodyEncrypted = encrypted.payload;
    encryptionVersion = encrypted.version;
    body = null;
  }

  const now = new Date();
  const messageId = crypto.randomUUID();
  db.insert(threadMessages)
    .values({
      id: messageId,
      conversationId,
      authorId: userId,
      body,
      bodyEncrypted,
      bodyFormat: "plain",
      encryptionVersion,
      isForwarded: Boolean(input.forwarded),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    .run();

  db.update(threadConversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(threadConversations.id, conversationId))
    .run();

  const mentionIds = input.mentions?.filter((mentionId) => mentionId !== userId);
  storeThreadMentions(conversationId, messageId, mentionIds);

  const author = ensureUserExists(userId);
  return {
    id: messageId,
    conversationId,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    isForwarded: Boolean(input.forwarded),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reactions: [],
    replyCount: 0,
    attachments: [],
    voiceNote: null
  };
}

export function updateThreadMessage(userId: string, messageId: string, input: UpdateThreadMessageInput): ThreadMessageSummary {
  const message = db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      authorId: threadMessages.authorId,
      body: threadMessages.body,
      bodyEncrypted: threadMessages.bodyEncrypted,
      encryptionVersion: threadMessages.encryptionVersion,
      createdAt: threadMessages.createdAt,
      updatedAt: threadMessages.updatedAt,
      deletedAt: threadMessages.deletedAt,
      isForwarded: threadMessages.isForwarded
    })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .get();

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = getConversation(message.conversationId);
  assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, message.conversationId, "dm_write");
  } else {
    assertConversationPermission(userId, message.conversationId, "channel_write");
    throw new ApiError(400, "Channels are not available yet");
  }

  if (message.authorId !== userId) {
    throw new ApiError(403, "You can only edit your own messages");
  }

  if (message.isForwarded) {
    throw new ApiError(400, "Forwarded messages cannot be edited");
  }

  if (message.deletedAt) {
    throw new ApiError(400, "This message was deleted");
  }

  const now = new Date();
  const editableUntil = message.createdAt.getTime() + 15 * 60 * 1000;
  if (now.getTime() > editableUntil) {
    throw new ApiError(400, "You can only edit a message within 15 minutes");
  }

  const trimmed = input.body.trim();
  if (!trimmed) {
    const hasAttachment = db
      .select({ id: threadAttachments.id })
      .from(threadAttachments)
      .where(eq(threadAttachments.messageId, messageId))
      .limit(1)
      .get();
    const hasVoice = db
      .select({ id: threadVoiceNotes.id })
      .from(threadVoiceNotes)
      .where(eq(threadVoiceNotes.messageId, messageId))
      .limit(1)
      .get();
    if (!hasAttachment && !hasVoice) {
      throw new ApiError(400, "Message body cannot be empty");
    }
  }

  let body: string | null = trimmed || null;
  let bodyEncrypted: string | null = null;
  let encryptionVersion = message.encryptionVersion ?? 1;

  if (conversation.type === "dm" && trimmed) {
    const encrypted = encryptDmBody(trimmed);
    bodyEncrypted = encrypted.payload;
    encryptionVersion = encrypted.version;
    body = null;
  }

  if (conversation.type === "dm" && !trimmed) {
    body = null;
    bodyEncrypted = null;
  }

  db.update(threadMessages)
    .set({ body, bodyEncrypted, encryptionVersion, updatedAt: now })
    .where(eq(threadMessages.id, messageId))
    .run();

  const author = ensureUserExists(userId);
  const reactions = getThreadMessageReactions([messageId]).get(messageId) ?? [];
  const replyCount = getThreadReplyCounts([messageId]).get(messageId) ?? 0;
  const attachments = getThreadAttachmentsForMessages([messageId]).get(messageId) ?? [];
  const voiceNote = getThreadVoiceNotesForMessages([messageId]).get(messageId) ?? null;

  return {
    id: messageId,
    conversationId: message.conversationId,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    isForwarded: Boolean(message.isForwarded),
    createdAt: message.createdAt,
    updatedAt: now,
    deletedAt: null,
    reactions,
    replyCount,
    attachments,
    voiceNote
  };
}

export function deleteThreadMessage(
  userId: string,
  messageId: string,
  scope: DeleteThreadMessageInput["scope"]
): { id: string; scope: "me" | "all"; message?: ThreadMessageSummary } {
  const message = db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      authorId: threadMessages.authorId,
      createdAt: threadMessages.createdAt,
      deletedAt: threadMessages.deletedAt,
      isForwarded: threadMessages.isForwarded,
      encryptionVersion: threadMessages.encryptionVersion
    })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .get();

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = getConversation(message.conversationId);
  assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, message.conversationId, "dm_write");
  } else {
    assertConversationPermission(userId, message.conversationId, "channel_write");
    throw new ApiError(400, "Channels are not available yet");
  }

  if (scope === "me") {
    try {
      db.insert(threadMessageDeletions)
        .values({
          messageId,
          userId,
          deletedAt: new Date()
        })
        .run();
    } catch {
      // ignore duplicates
    }
    return { id: messageId, scope: "me" };
  }

  if (message.authorId !== userId) {
    throw new ApiError(403, "You can only delete your own messages for everyone");
  }

  if (message.deletedAt) {
    throw new ApiError(400, "This message was already deleted");
  }

  const otherMembers = db
    .select({ userId: threadMembers.userId, lastReadAt: threadMembers.lastReadAt })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, message.conversationId), ne(threadMembers.userId, userId)))
    .all();

  const seenByOthers = otherMembers.some((member) => {
    if (!member.lastReadAt) return false;
    return member.lastReadAt.getTime() >= message.createdAt.getTime();
  });

  if (seenByOthers) {
    throw new ApiError(400, "Cannot delete for all after it was seen");
  }

  const now = new Date();

  const attachments = db
    .select({ id: threadAttachments.id, storagePath: threadAttachments.storagePath })
    .from(threadAttachments)
    .where(eq(threadAttachments.messageId, messageId))
    .all();

  const voiceNotes = db
    .select({ id: threadVoiceNotes.id, storagePath: threadVoiceNotes.storagePath })
    .from(threadVoiceNotes)
    .where(eq(threadVoiceNotes.messageId, messageId))
    .all();

  db.delete(threadMessageReactions)
    .where(eq(threadMessageReactions.messageId, messageId))
    .run();
  db.delete(threadMentions)
    .where(eq(threadMentions.messageId, messageId))
    .run();
  db.delete(threadMessageDeletions)
    .where(eq(threadMessageDeletions.messageId, messageId))
    .run();
  db.delete(threadAttachments)
    .where(eq(threadAttachments.messageId, messageId))
    .run();
  db.delete(threadVoiceNotes)
    .where(eq(threadVoiceNotes.messageId, messageId))
    .run();

  for (const attachment of attachments) {
    const filePath = resolveThreadAttachmentPath(attachment.storagePath);
    void fs.rm(filePath, { force: true }).catch(() => {});
  }
  for (const voiceNote of voiceNotes) {
    const filePath = resolveThreadVoiceNotePath(voiceNote.storagePath);
    void fs.rm(filePath, { force: true }).catch(() => {});
  }

  db.update(threadMessages)
    .set({
      body: null,
      bodyEncrypted: null,
      updatedAt: now,
      deletedAt: now
    })
    .where(eq(threadMessages.id, messageId))
    .run();

  const author = ensureUserExists(userId);
  return {
    id: messageId,
    scope: "all",
    message: {
      id: messageId,
      conversationId: message.conversationId,
      author,
      body: "This message was deleted.",
      isForwarded: Boolean(message.isForwarded),
      createdAt: message.createdAt,
      updatedAt: now,
      deletedAt: now,
      reactions: [],
      replyCount: 0,
      attachments: [],
      voiceNote: null
    }
  };
}
