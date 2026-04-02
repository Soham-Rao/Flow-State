import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { emitThreadEvent } from "../../realtime/socket.js";
import { threadAttachments, threadMessages, threadVoiceNotes, threadReplyAttachments, threadReplyVoiceNotes, threadReplies } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { ThreadAttachment, ThreadVoiceNote, ThreadReplyAttachment, ThreadReplyVoiceNote } from "./threads.service.types.js";
import { assertConversationMember, assertConversationPermission, getConversation } from "./threads.service.access.js";
import {
  getThreadAttachmentRecord,
  getThreadReplyAttachmentRecord,
  getThreadReplyVoiceNoteRecord,
  getThreadVoiceNoteRecord
} from "./threads.service.data.js";
import {
  buildThreadAttachmentStoragePath,
  buildThreadReplyAttachmentStoragePath,
  buildThreadReplyVoiceNoteStoragePath,
  buildThreadVoiceNoteStoragePath,
  ensureThreadAttachmentDirectory,
  ensureThreadReplyAttachmentDirectory,
  ensureThreadReplyVoiceNoteDirectory,
  ensureThreadVoiceNoteDirectory,
  getVoiceNoteExtension,
  resolveThreadAttachmentPath,
  resolveThreadReplyAttachmentPath,
  resolveThreadReplyVoiceNotePath,
  resolveThreadVoiceNotePath
} from "./threads.service.storage.js";

export async function createThreadAttachments(
  userId: string,
  messageId: string,
  files: Express.Multer.File[]
): Promise<ThreadAttachment[]> {
  const messageRows = await db
    .select({ id: threadMessages.id, conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .limit(1);

  const message = messageRows[0];

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(message.conversationId);
  await assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, message.conversationId, "dm_write");
  } else {
    await assertConversationPermission(userId, message.conversationId, "channel_write");
  }

  if (!files || files.length === 0) {
    throw new ApiError(400, "No attachments provided");
  }

  const now = new Date();
  const created: ThreadAttachment[] = [];

  for (const file of files) {
    const attachmentId = crypto.randomUUID();
    const originalName = path.basename(file.originalname || "attachment");
    const extension = path.extname(originalName);
    const storedName = `${attachmentId}${extension}`;
    const storagePath = buildThreadAttachmentStoragePath(message.conversationId, messageId, storedName);
    const absolutePath = resolveThreadAttachmentPath(storagePath);

    await ensureThreadAttachmentDirectory(absolutePath);
    await fs.writeFile(absolutePath, file.buffer);

    await db.insert(threadAttachments)
      .values({
        id: attachmentId,
        messageId,
        originalName,
        mimeType: file.mimetype ?? null,
        size: file.size ?? 0,
        storagePath,
        createdAt: now
      })
      .execute();

    created.push({
      id: attachmentId,
      messageId,
      originalName,
      mimeType: file.mimetype ?? null,
      size: file.size ?? 0,
      createdAt: now
    });
  }

  emitThreadEvent(message.conversationId, "threads:message:edit", { conversationId: message.conversationId });
  return created;
}

export async function createThreadVoiceNote(
  userId: string,
  messageId: string,
  file: Express.Multer.File | undefined,
  durationSec: number
): Promise<ThreadVoiceNote> {
  if (!file) {
    throw new ApiError(400, "Voice message is required");
  }

  const messageRows = await db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      authorId: threadMessages.authorId
    })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .limit(1);

  const message = messageRows[0];

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(message.conversationId);
  await assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, message.conversationId, "dm_write");
  } else {
    await assertConversationPermission(userId, message.conversationId, "channel_write");
  }

  if (message.authorId !== userId) {
    throw new ApiError(403, "Only the message author can upload a voice note");
  }

  const existingRows = await db
    .select({ id: threadVoiceNotes.id })
    .from(threadVoiceNotes)
    .where(eq(threadVoiceNotes.messageId, messageId))
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    throw new ApiError(400, "Voice note already exists for this message");
  }

  const voiceNoteId = crypto.randomUUID();
  const extension = getVoiceNoteExtension(file);
  const storagePath = buildThreadVoiceNoteStoragePath(message.conversationId, messageId, voiceNoteId, extension);
  const absolutePath = resolveThreadVoiceNotePath(storagePath);

  await ensureThreadVoiceNoteDirectory(absolutePath);
  await fs.writeFile(absolutePath, file.buffer);

  const now = new Date();
  const normalizedDuration = Number.isFinite(durationSec) ? Math.max(0, Math.round(durationSec)) : 0;

  await db.insert(threadVoiceNotes)
    .values({
      id: voiceNoteId,
      messageId,
      durationSec: normalizedDuration,
      storagePath,
      createdAt: now
    })
    .execute();

  const summary = {
    id: voiceNoteId,
    messageId,
    durationSec: normalizedDuration,
    createdAt: now
  };
  emitThreadEvent(message.conversationId, "threads:message:edit", { conversationId: message.conversationId });
  return summary;
}


export async function createThreadReplyAttachments(
  userId: string,
  replyId: string,
  files: Express.Multer.File[]
): Promise<ThreadReplyAttachment[]> {
  const replyRows = await db
    .select({ id: threadReplies.id, parentMessageId: threadReplies.parentMessageId })
    .from(threadReplies)
    .where(eq(threadReplies.id, replyId))
    .limit(1);

  const reply = replyRows[0];

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  const parentRows = await db
    .select({ conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, reply.parentMessageId))
    .limit(1);

  const parent = parentRows[0];

  if (!parent) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(parent.conversationId);
  await assertConversationMember(userId, parent.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, parent.conversationId, "dm_write");
  } else {
    await assertConversationPermission(userId, parent.conversationId, "channel_write");
  }

  if (!files || files.length === 0) {
    throw new ApiError(400, "No attachments provided");
  }

  const now = new Date();
  const created: ThreadReplyAttachment[] = [];

  for (const file of files) {
    const attachmentId = crypto.randomUUID();
    const originalName = path.basename(file.originalname || "attachment");
    const extension = path.extname(originalName);
    const storedName = `${attachmentId}${extension}`;
    const storagePath = buildThreadReplyAttachmentStoragePath(parent.conversationId, replyId, storedName);
    const absolutePath = resolveThreadReplyAttachmentPath(storagePath);

    await ensureThreadReplyAttachmentDirectory(absolutePath);
    await fs.writeFile(absolutePath, file.buffer);

    await db.insert(threadReplyAttachments)
      .values({
        id: attachmentId,
        replyId,
        originalName,
        mimeType: file.mimetype ?? null,
        size: file.size ?? 0,
        storagePath,
        createdAt: now
      })
      .execute();

    created.push({
      id: attachmentId,
      replyId,
      originalName,
      mimeType: file.mimetype ?? null,
      size: file.size ?? 0,
      createdAt: now
    });
  }

  emitThreadEvent(parent.conversationId, "threads:message:edit", { conversationId: parent.conversationId });
  emitThreadEvent(parent.conversationId, "threads:reply:edit", { conversationId: parent.conversationId });
  return created;
}

export async function createThreadReplyVoiceNote(
  userId: string,
  replyId: string,
  file: Express.Multer.File | undefined,
  durationSec: number
): Promise<ThreadReplyVoiceNote> {
  if (!file) {
    throw new ApiError(400, "Voice message is required");
  }

  const replyRows = await db
    .select({ id: threadReplies.id, parentMessageId: threadReplies.parentMessageId, authorId: threadReplies.authorId })
    .from(threadReplies)
    .where(eq(threadReplies.id, replyId))
    .limit(1);

  const reply = replyRows[0];

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  const parentRows = await db
    .select({ conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, reply.parentMessageId))
    .limit(1);

  const parent = parentRows[0];

  if (!parent) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(parent.conversationId);
  await assertConversationMember(userId, parent.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, parent.conversationId, "dm_write");
  } else {
    await assertConversationPermission(userId, parent.conversationId, "channel_write");
  }

  if (reply.authorId !== userId) {
    throw new ApiError(403, "Only the reply author can upload a voice note");
  }

  const existingRows = await db
    .select({ id: threadReplyVoiceNotes.id })
    .from(threadReplyVoiceNotes)
    .where(eq(threadReplyVoiceNotes.replyId, replyId))
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    throw new ApiError(400, "Voice note already exists for this reply");
  }

  const voiceNoteId = crypto.randomUUID();
  const extension = getVoiceNoteExtension(file);
  const storagePath = buildThreadReplyVoiceNoteStoragePath(parent.conversationId, replyId, voiceNoteId, extension);
  const absolutePath = resolveThreadReplyVoiceNotePath(storagePath);

  await ensureThreadReplyVoiceNoteDirectory(absolutePath);
  await fs.writeFile(absolutePath, file.buffer);

  const now = new Date();
  const normalizedDuration = Number.isFinite(durationSec) ? Math.max(0, Math.round(durationSec)) : 0;

  await db.insert(threadReplyVoiceNotes)
    .values({
      id: voiceNoteId,
      replyId,
      durationSec: normalizedDuration,
      storagePath,
      createdAt: now
    })
    .execute();

  const summary = {
    id: voiceNoteId,
    replyId,
    durationSec: normalizedDuration,
    createdAt: now
  };
  emitThreadEvent(parent.conversationId, "threads:reply:edit", { conversationId: parent.conversationId });
  return summary;
}

export async function getThreadReplyVoiceNoteDownloadInfo(
  userId: string,
  voiceNoteId: string
): Promise<{ filePath: string; filename: string }> {
  const voiceNote = await getThreadReplyVoiceNoteRecord(voiceNoteId);
  const replyRows = await db
    .select({ parentMessageId: threadReplies.parentMessageId })
    .from(threadReplies)
    .where(eq(threadReplies.id, voiceNote.replyId))
    .limit(1);

  const reply = replyRows[0];

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  const parentRows = await db
    .select({ conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, reply.parentMessageId))
    .limit(1);

  const parent = parentRows[0];

  if (!parent) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(parent.conversationId);
  await assertConversationMember(userId, parent.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, parent.conversationId, "dm_read");
  } else {
    await assertConversationPermission(userId, parent.conversationId, "channel_read");
  }

  const filePath = resolveThreadReplyVoiceNotePath(voiceNote.storagePath);
  const extension = path.extname(voiceNote.storagePath) || ".webm";

  return {
    filePath,
    filename: `voice-note${extension}`
  };
}

export async function getThreadReplyAttachmentDownloadInfo(
  userId: string,
  attachmentId: string
): Promise<{ filePath: string; originalName: string }> {
  const attachment = await getThreadReplyAttachmentRecord(attachmentId);
  const replyRows = await db
    .select({ parentMessageId: threadReplies.parentMessageId })
    .from(threadReplies)
    .where(eq(threadReplies.id, attachment.replyId))
    .limit(1);

  const reply = replyRows[0];

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  const parentRows = await db
    .select({ conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, reply.parentMessageId))
    .limit(1);

  const parent = parentRows[0];

  if (!parent) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(parent.conversationId);
  await assertConversationMember(userId, parent.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, parent.conversationId, "dm_read");
  } else {
    await assertConversationPermission(userId, parent.conversationId, "channel_read");
  }

  return {
    filePath: resolveThreadReplyAttachmentPath(attachment.storagePath),
    originalName: attachment.originalName
  };
}

export async function getThreadVoiceNoteDownloadInfo(
  userId: string,
  voiceNoteId: string
): Promise<{ filePath: string; filename: string }> {
  const voiceNote = await getThreadVoiceNoteRecord(voiceNoteId);
  const messageRows = await db
    .select({ conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, voiceNote.messageId))
    .limit(1);

  const message = messageRows[0];

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const conversation = await getConversation(message.conversationId);
  await assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, message.conversationId, "dm_read");
  } else {
    await assertConversationPermission(userId, message.conversationId, "channel_read");
  }

  const filePath = resolveThreadVoiceNotePath(voiceNote.storagePath);
  const extension = path.extname(voiceNote.storagePath) || ".webm";

  return {
    filePath,
    filename: `voice-note${extension}`
  };
}

export async function getThreadAttachmentDownloadInfo(attachmentId: string): Promise<{ filePath: string; originalName: string }> {
  const attachment = await getThreadAttachmentRecord(attachmentId);
  return {
    filePath: resolveThreadAttachmentPath(attachment.storagePath),
    originalName: attachment.originalName
  };
}
