import crypto from "node:crypto";
import fs from "node:fs/promises";

import { and, desc, eq, lt } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { threadMessages, threadReplies, threadReplyAttachments, threadReplyDeletions, threadReplyMentions, threadReplyReactions, threadReplyVoiceNotes, users } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody, encryptDmBody } from "../../utils/encryption.js";
import { assertPermission } from "../../utils/permissions.js";
import type { CreateThreadReplyInput, DeleteThreadReplyInput, ThreadMessageListParams, UpdateThreadReplyInput } from "./threads.schema.js";
import type { ThreadReactionDetail, ThreadReplySummary, ThreadUserSummary } from "./threads.service.types.js";
import { assertConversationMember, assertConversationPermission, ensureUserExists, getConversation } from "./threads.service.access.js";
import { storeThreadReplyMentions } from "./threads.service.mentions.js";
import { getThreadAttachmentsForReplies, getThreadReplyDeletionSet, getThreadReplyReactions, getThreadVoiceNotesForReplies } from "./threads.service.data.js";
import { resolveThreadReplyAttachmentPath, resolveThreadReplyVoiceNotePath } from "./threads.service.storage.js";

export function listThreadReplies(
  userId: string,
  messageId: string,
  params: ThreadMessageListParams = {}
): ThreadReplySummary[] {
  const parent = db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId
    })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .get();

  if (!parent) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = getConversation(parent.conversationId);
  assertConversationMember(userId, parent.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, parent.conversationId, "dm_read");
  } else {
    assertConversationPermission(userId, parent.conversationId, "channel_read");
  }

  const limit = params.limit ?? 50;
  const conditions = [eq(threadReplies.parentMessageId, messageId)];
  if (params.cursor) {
    conditions.push(lt(threadReplies.createdAt, new Date(params.cursor)));
  }

  const rows = db
    .select({
      id: threadReplies.id,
      parentMessageId: threadReplies.parentMessageId,
      body: threadReplies.body,
      bodyEncrypted: threadReplies.bodyEncrypted,
      encryptionVersion: threadReplies.encryptionVersion,
      createdAt: threadReplies.createdAt,
      updatedAt: threadReplies.updatedAt,
      deletedAt: threadReplies.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role
    })
    .from(threadReplies)
    .innerJoin(users, eq(threadReplies.authorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(threadReplies.createdAt))
    .limit(limit)
    .all();

  const replyIds = rows.map((row) => row.id);
  const deletedForUser = getThreadReplyDeletionSet(userId, replyIds);
  const filteredRows = rows.filter((row) => !deletedForUser.has(row.id));
  const visibleReplyIds = filteredRows.map((row) => row.id);
  const reactionsByReplyId = getThreadReplyReactions(visibleReplyIds);
  const attachmentsByReplyId = getThreadAttachmentsForReplies(visibleReplyIds);
  const voiceNotesByReplyId = getThreadVoiceNotesForReplies(visibleReplyIds);

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
      parentMessageId: row.parentMessageId,
      author: {
        id: row.authorId,
        name: row.authorName,
        displayName: row.authorDisplayName,
        username: row.authorUsername,
        email: row.authorEmail,
        role: row.authorRole
      },
      body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      reactions: isDeleted ? [] : reactionsByReplyId.get(row.id) ?? [],
      attachments: isDeleted ? [] : attachmentsByReplyId.get(row.id) ?? [],
      voiceNote: isDeleted ? null : voiceNotesByReplyId.get(row.id) ?? null
    };
  });

  return summaries.reverse();
}

export function listThreadReplyReactionDetails(userId: string, replyId: string): ThreadReactionDetail[] {
  const reply = db
    .select({
      id: threadReplies.id,
      parentMessageId: threadReplies.parentMessageId,
      conversationId: threadMessages.conversationId,
      deletedAt: threadReplies.deletedAt
    })
    .from(threadReplies)
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .where(eq(threadReplies.id, replyId))
    .get();

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  if (reply.deletedAt) {
    return [];
  }

  const conversation = getConversation(reply.conversationId);
  assertConversationMember(userId, reply.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, reply.conversationId, "dm_read");
  } else {
    assertConversationPermission(userId, reply.conversationId, "channel_read");
  }

  const rows = db
    .select({
      emoji: threadReplyReactions.emoji,
      userId: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role
    })
    .from(threadReplyReactions)
    .innerJoin(users, eq(threadReplyReactions.userId, users.id))
    .where(eq(threadReplyReactions.replyId, replyId))
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

export function createThreadReply(userId: string, messageId: string, input: CreateThreadReplyInput): ThreadReplySummary {
  const parent = db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId
    })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .get();

  if (!parent) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = getConversation(parent.conversationId);
  assertConversationMember(userId, parent.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, parent.conversationId, "dm_write");
  } else {
    assertConversationPermission(userId, parent.conversationId, "channel_write");
  }

  const trimmed = input.body.trim();
  const hasAttachments = Boolean((input as any).hasAttachments);
  const hasVoiceNote = Boolean((input as any).hasVoiceNote);
  if (!trimmed && !hasAttachments && !hasVoiceNote) {
    throw new ApiError(400, "Reply body cannot be empty");
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
  const replyId = crypto.randomUUID();
  db.insert(threadReplies)
    .values({
      id: replyId,
      parentMessageId: messageId,
      authorId: userId,
      body,
      bodyEncrypted,
      bodyFormat: "plain",
      encryptionVersion,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    .run();

  storeThreadReplyMentions(conversation.id, replyId, input.mentions, userId);

  const author = ensureUserExists(userId);
  return {
    id: replyId,
    parentMessageId: messageId,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reactions: [],
    attachments: [],
    voiceNote: null
  };
}


export function updateThreadReply(userId: string, replyId: string, input: UpdateThreadReplyInput): ThreadReplySummary {
  const reply = db
    .select({
      id: threadReplies.id,
      parentMessageId: threadReplies.parentMessageId,
      conversationId: threadMessages.conversationId,
      authorId: threadReplies.authorId,
      body: threadReplies.body,
      bodyEncrypted: threadReplies.bodyEncrypted,
      encryptionVersion: threadReplies.encryptionVersion,
      createdAt: threadReplies.createdAt,
      updatedAt: threadReplies.updatedAt,
      deletedAt: threadReplies.deletedAt
    })
    .from(threadReplies)
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .where(eq(threadReplies.id, replyId))
    .get();

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  const conversation = getConversation(reply.conversationId);
  assertConversationMember(userId, reply.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, reply.conversationId, "dm_write");
  } else {
    assertConversationPermission(userId, reply.conversationId, "channel_write");
  }

  if (reply.authorId !== userId) {
    throw new ApiError(403, "You can only edit your own replies");
  }

  if (reply.deletedAt) {
    throw new ApiError(400, "This reply was deleted");
  }

  const now = new Date();
  const editableUntil = reply.createdAt.getTime() + 15 * 60 * 1000;
  if (now.getTime() > editableUntil) {
    throw new ApiError(400, "You can only edit a reply within 15 minutes");
  }

  const trimmed = input.body.trim();
  if (!trimmed) {
    const hasAttachment = db
      .select({ id: threadReplyAttachments.id })
      .from(threadReplyAttachments)
      .where(eq(threadReplyAttachments.replyId, replyId))
      .limit(1)
      .get();
    const hasVoice = db
      .select({ id: threadReplyVoiceNotes.id })
      .from(threadReplyVoiceNotes)
      .where(eq(threadReplyVoiceNotes.replyId, replyId))
      .limit(1)
      .get();
    if (!hasAttachment && !hasVoice) {
      throw new ApiError(400, "Reply body cannot be empty");
    }
  }

  let body: string | null = trimmed || null;
  let bodyEncrypted: string | null = null;
  let encryptionVersion = reply.encryptionVersion ?? 1;

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

  db.update(threadReplies)
    .set({ body, bodyEncrypted, encryptionVersion, updatedAt: now })
    .where(eq(threadReplies.id, replyId))
    .run();

  const author = ensureUserExists(userId);
  const reactions = getThreadReplyReactions([replyId]).get(replyId) ?? [];
  const attachments = getThreadAttachmentsForReplies([replyId]).get(replyId) ?? [];
  const voiceNote = getThreadVoiceNotesForReplies([replyId]).get(replyId) ?? null;

  return {
    id: replyId,
    parentMessageId: reply.parentMessageId,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    createdAt: reply.createdAt,
    updatedAt: now,
    deletedAt: null,
    reactions,
    attachments,
    voiceNote
  };
}

export function deleteThreadReply(
  userId: string,
  replyId: string,
  scope: DeleteThreadReplyInput["scope"]
): { id: string; scope: "me" | "all" } {
  const reply = db
    .select({
      id: threadReplies.id,
      parentMessageId: threadReplies.parentMessageId,
      conversationId: threadMessages.conversationId,
      authorId: threadReplies.authorId,
      createdAt: threadReplies.createdAt,
      deletedAt: threadReplies.deletedAt,
      encryptionVersion: threadReplies.encryptionVersion
    })
    .from(threadReplies)
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .where(eq(threadReplies.id, replyId))
    .get();

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  const conversation = getConversation(reply.conversationId);
  assertConversationMember(userId, reply.conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, reply.conversationId, "dm_write");
  } else {
    assertConversationPermission(userId, reply.conversationId, "channel_write");
  }

  if (scope === "all") {
    assertPermission(userId, "delete_threads");
  }

  if (scope === "me") {
    try {
      db.insert(threadReplyDeletions)
        .values({
          replyId,
          userId,
          deletedAt: new Date()
        })
        .run();
    } catch {
      // ignore duplicates
    }
    return { id: replyId, scope: "me" };
  }

  if (reply.authorId !== userId) {
    throw new ApiError(403, "You can only delete your own replies");
  }

  if (reply.deletedAt) {
    throw new ApiError(400, "This reply was already deleted");
  }

  const now = new Date();
  const attachments = db
    .select({ id: threadReplyAttachments.id, storagePath: threadReplyAttachments.storagePath })
    .from(threadReplyAttachments)
    .where(eq(threadReplyAttachments.replyId, replyId))
    .all();

  const voiceNotes = db
    .select({ id: threadReplyVoiceNotes.id, storagePath: threadReplyVoiceNotes.storagePath })
    .from(threadReplyVoiceNotes)
    .where(eq(threadReplyVoiceNotes.replyId, replyId))
    .all();

  db.delete(threadReplyReactions)
    .where(eq(threadReplyReactions.replyId, replyId))
    .run();
  db.delete(threadReplyMentions)
    .where(eq(threadReplyMentions.replyId, replyId))
    .run();
  db.delete(threadReplyDeletions)
    .where(eq(threadReplyDeletions.replyId, replyId))
    .run();
  db.delete(threadReplyAttachments)
    .where(eq(threadReplyAttachments.replyId, replyId))
    .run();
  db.delete(threadReplyVoiceNotes)
    .where(eq(threadReplyVoiceNotes.replyId, replyId))
    .run();

  for (const attachment of attachments) {
    const filePath = resolveThreadReplyAttachmentPath(attachment.storagePath);
    void fs.rm(filePath, { force: true }).catch(() => {});
  }
  for (const voiceNote of voiceNotes) {
    const filePath = resolveThreadReplyVoiceNotePath(voiceNote.storagePath);
    void fs.rm(filePath, { force: true }).catch(() => {});
  }

  db.update(threadReplies)
    .set({
      body: null,
      bodyEncrypted: null,
      updatedAt: now,
      deletedAt: now
    })
    .where(eq(threadReplies.id, replyId))
    .run();

  return { id: replyId, scope: "all" };
}

