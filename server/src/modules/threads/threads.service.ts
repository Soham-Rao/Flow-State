import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";

import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  threadConversations,
  threadMembers,
  threadMessages,
  threadMentions,
  threadReplies,
  threadAttachments,
  threadReplyMentions,
  threadMessageReactions,
  threadReplyReactions,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody, encryptDmBody } from "../../utils/encryption.js";
import { assertPermission } from "../../utils/permissions.js";
import type { CreateThreadMessageInput, CreateThreadReplyInput, ThreadMessageListParams, ThreadReactionInput } from "./threads.schema.js";

export interface ThreadUserSummary {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  role: "admin" | "member" | "guest";
}

export interface DmConversationSummary {
  id: string;
  type: "dm";
  otherUser: ThreadUserSummary;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadMentions: number;
}

export interface ThreadAttachment {
  id: string;
  messageId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: Date;
}

export interface ThreadReaction {
  emoji: string;
  count: number;
}

export interface ThreadMessageSummary {
  id: string;
  conversationId: string;
  author: ThreadUserSummary;
  body: string | null;
  isForwarded: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  reactions: ThreadReaction[];
  replyCount: number;
  attachments: ThreadAttachment[];
}

export interface ThreadReplySummary {
  id: string;
  parentMessageId: string;
  author: ThreadUserSummary;
  body: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  reactions: ThreadReaction[];
}

function getUserSummary(userId: string): ThreadUserSummary | null {
  const row = db
    .select({ id: users.id, name: users.name, displayName: users.displayName, username: users.username, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row ?? null;
}

function ensureUserExists(userId: string): ThreadUserSummary {
  const user = getUserSummary(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
}

function getConversation(conversationId: string) {
  const conversation = db
    .select({ id: threadConversations.id, type: threadConversations.type })
    .from(threadConversations)
    .where(eq(threadConversations.id, conversationId))
    .get();
  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }
  return conversation;
}

function assertConversationMember(userId: string, conversationId: string): void {
  const membership = db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .get();
  if (!membership) {
    throw new ApiError(403, "You do not have access to this conversation");
  }
}

function assertConversationPermission(userId: string, conversationId: string, permission: "dm_read" | "dm_write" | "channel_read" | "channel_write"): void {
  assertPermission(userId, permission, { scopeType: "section", scopeId: conversationId });
}


const THREAD_UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function buildThreadAttachmentStoragePath(conversationId: string, messageId: string, storedName: string): string {
  return path.join("threads", conversationId, messageId, storedName);
}

function resolveThreadAttachmentPath(storagePath: string): string {
  return path.join(THREAD_UPLOADS_ROOT, storagePath);
}

async function ensureThreadAttachmentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function normalizeMentions(mentions: string[] | undefined): string[] {
  if (!mentions || mentions.length === 0) {
    return [];
  }
  return Array.from(new Set(mentions));
}

function storeThreadMentions(conversationId: string, messageId: string, mentions: string[] | undefined): void {
  const uniqueMentions = normalizeMentions(mentions);
  if (uniqueMentions.length === 0) {
    return;
  }

  const existingUsers = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueMentions))
    .all();

  if (existingUsers.length === 0) {
    return;
  }

  const allowed = db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), inArray(threadMembers.userId, existingUsers.map((user) => user.id))))
    .all()
    .map((row) => row.userId);

  if (allowed.length === 0) {
    return;
  }

  const now = new Date();
  db.insert(threadMentions)
    .values(allowed.map((userId) => ({
      id: crypto.randomUUID(),
      messageId,
      mentionedUserId: userId,
      createdAt: now,
      seenAt: null
    })))
    .run();
}

function storeThreadReplyMentions(conversationId: string, replyId: string, mentions: string[] | undefined): void {
  const uniqueMentions = normalizeMentions(mentions);
  if (uniqueMentions.length === 0) {
    return;
  }

  const existingUsers = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueMentions))
    .all();

  if (existingUsers.length === 0) {
    return;
  }

  const allowed = db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), inArray(threadMembers.userId, existingUsers.map((user) => user.id))))
    .all()
    .map((row) => row.userId);

  if (allowed.length === 0) {
    return;
  }

  const now = new Date();
  db.insert(threadReplyMentions)
    .values(allowed.map((userId) => ({
      id: crypto.randomUUID(),
      replyId,
      mentionedUserId: userId,
      createdAt: now,
      seenAt: null
    })))
    .run();
}

function getThreadMessageReactions(messageIds: string[]): Map<string, ThreadReaction[]> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({ messageId: threadMessageReactions.messageId, emoji: threadMessageReactions.emoji })
    .from(threadMessageReactions)
    .where(inArray(threadMessageReactions.messageId, messageIds))
    .all() as Array<{ messageId: string; emoji: string }>;

  const countsByMessageId = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const emojiCounts = countsByMessageId.get(row.messageId) ?? new Map<string, number>();
    emojiCounts.set(row.emoji, (emojiCounts.get(row.emoji) ?? 0) + 1);
    countsByMessageId.set(row.messageId, emojiCounts);
  }

  const reactionsByMessageId = new Map<string, ThreadReaction[]>();
  for (const [messageId, emojiCounts] of countsByMessageId) {
    const reactions = Array.from(emojiCounts.entries()).map(([emoji, count]) => ({ emoji, count }));
    reactionsByMessageId.set(messageId, reactions);
  }

  return reactionsByMessageId;
}

function getThreadReplyReactions(replyIds: string[]): Map<string, ThreadReaction[]> {
  if (replyIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({ replyId: threadReplyReactions.replyId, emoji: threadReplyReactions.emoji })
    .from(threadReplyReactions)
    .where(inArray(threadReplyReactions.replyId, replyIds))
    .all() as Array<{ replyId: string; emoji: string }>;

  const countsByReplyId = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const emojiCounts = countsByReplyId.get(row.replyId) ?? new Map<string, number>();
    emojiCounts.set(row.emoji, (emojiCounts.get(row.emoji) ?? 0) + 1);
    countsByReplyId.set(row.replyId, emojiCounts);
  }

  const reactionsByReplyId = new Map<string, ThreadReaction[]>();
  for (const [replyId, emojiCounts] of countsByReplyId) {
    const reactions = Array.from(emojiCounts.entries()).map(([emoji, count]) => ({ emoji, count }));
    reactionsByReplyId.set(replyId, reactions);
  }

  return reactionsByReplyId;
}

function getThreadReplyCounts(messageIds: string[]): Map<string, number> {
  if (messageIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({ messageId: threadReplies.parentMessageId, count: sql<number>`count(*)` })
    .from(threadReplies)
    .where(and(inArray(threadReplies.parentMessageId, messageIds), isNull(threadReplies.deletedAt)))
    .groupBy(threadReplies.parentMessageId)
    .all() as Array<{ messageId: string; count: number }>;

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.messageId, row.count);
  }

  return counts;
}

function getThreadAttachmentsForMessages(messageIds: string[]): Map<string, ThreadAttachment[]> {
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
    .all() as ThreadAttachment[];

  const attachmentsByMessageId = new Map<string, ThreadAttachment[]>();
  for (const row of rows) {
    const list = attachmentsByMessageId.get(row.messageId) ?? [];
    list.push(row);
    attachmentsByMessageId.set(row.messageId, list);
  }

  return attachmentsByMessageId;
}

function getThreadAttachmentRecord(attachmentId: string): ThreadAttachment & { storagePath: string } {
  const row = db
    .select({
      id: threadAttachments.id,
      messageId: threadAttachments.messageId,
      originalName: threadAttachments.originalName,
      mimeType: threadAttachments.mimeType,
      size: threadAttachments.size,
      createdAt: threadAttachments.createdAt,
      storagePath: threadAttachments.storagePath
    })
    .from(threadAttachments)
    .where(eq(threadAttachments.id, attachmentId))
    .get();

  if (!row) {
    throw new ApiError(404, "Attachment not found");
  }

  return row as ThreadAttachment & { storagePath: string };
}

function resolveDmConversationId(userId: string, otherUserId: string): string | null {
  const dmConversations = db
    .select({ id: threadConversations.id })
    .from(threadConversations)
    .where(eq(threadConversations.type, "dm"))
    .all();

  const participantSet = new Set([userId, otherUserId]);
  for (const conversation of dmConversations) {
    const members = db
      .select({ userId: threadMembers.userId })
      .from(threadMembers)
      .where(eq(threadMembers.conversationId, conversation.id))
      .all()
      .map((member) => member.userId);

    if (members.length !== participantSet.size) {
      continue;
    }

    const isMatch = members.every((memberId) => participantSet.has(memberId));
    if (isMatch) {
      return conversation.id;
    }
  }

  return null;
}

function getUnreadMentionsForConversation(conversationId: string, userId: string): number {
  const messageMentions = db
    .select({ count: sql<number>`count(*)` })
    .from(threadMentions)
    .innerJoin(threadMessages, eq(threadMentions.messageId, threadMessages.id))
    .where(
      and(
        eq(threadMessages.conversationId, conversationId),
        eq(threadMentions.mentionedUserId, userId),
        isNull(threadMentions.seenAt),
        ne(threadMessages.authorId, threadMentions.mentionedUserId)
      )
    )
    .get();

  const replyMentions = db
    .select({ count: sql<number>`count(*)` })
    .from(threadReplyMentions)
    .innerJoin(threadReplies, eq(threadReplyMentions.replyId, threadReplies.id))
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .where(
      and(
        eq(threadMessages.conversationId, conversationId),
        eq(threadReplyMentions.mentionedUserId, userId),
        isNull(threadReplyMentions.seenAt),
        ne(threadReplies.authorId, threadReplyMentions.mentionedUserId)
      )
    )
    .get();

  return (messageMentions?.count ?? 0) + (replyMentions?.count ?? 0);
}

export function listDmUsers(): ThreadUserSummary[] {
  return db
    .select({ id: users.id, name: users.name, displayName: users.displayName, username: users.username, email: users.email, role: users.role })
    .from(users)
    .orderBy(users.name)
    .all();
}

export function listDmConversations(userId: string): DmConversationSummary[] {
  assertPermission(userId, "dm_read");

  const conversations = db
    .select({ id: threadConversations.id, lastMessageAt: threadConversations.lastMessageAt })
    .from(threadConversations)
    .innerJoin(threadMembers, eq(threadMembers.conversationId, threadConversations.id))
    .where(and(eq(threadMembers.userId, userId), eq(threadConversations.type, "dm")))
    .all();

  return conversations.map((conversation) => {
    const members = db
      .select({ id: users.id, name: users.name, displayName: users.displayName, username: users.username, email: users.email, role: users.role })
      .from(threadMembers)
      .innerJoin(users, eq(threadMembers.userId, users.id))
      .where(eq(threadMembers.conversationId, conversation.id))
      .all();

    const otherUser = members.find((member) => member.id !== userId) ?? members[0];
    if (!otherUser) {
      throw new ApiError(500, "Conversation members missing");
    }

    const lastMessage = db
      .select({
        body: threadMessages.body,
        bodyEncrypted: threadMessages.bodyEncrypted,
        encryptionVersion: threadMessages.encryptionVersion
      })
      .from(threadMessages)
      .where(and(eq(threadMessages.conversationId, conversation.id), isNull(threadMessages.deletedAt)))
      .orderBy(desc(threadMessages.createdAt))
      .limit(1)
      .get();

    let lastMessagePreview: string | null = null;
    if (lastMessage) {
      if (lastMessage.bodyEncrypted) {
        lastMessagePreview = decryptDmBody(lastMessage.bodyEncrypted, lastMessage.encryptionVersion);
      } else {
        lastMessagePreview = lastMessage.body ?? null;
      }
    }

    return {
      id: conversation.id,
      type: "dm",
      otherUser,
      lastMessageAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt) : null,
      lastMessagePreview,
      unreadMentions: getUnreadMentionsForConversation(conversation.id, userId)
    };
  });
}

export function getOrCreateDmConversation(userId: string, otherUserId: string): DmConversationSummary {
  assertPermission(userId, "dm_read");
  const currentUser = ensureUserExists(userId);
  const otherUser = ensureUserExists(otherUserId);

  const existingId = resolveDmConversationId(userId, otherUserId);
  if (existingId) {
    const summary = listDmConversations(userId).find((conversation) => conversation.id === existingId);
    if (summary) {
      return summary;
    }
  }

  const now = new Date();
  const conversationId = crypto.randomUUID();
  db.insert(threadConversations)
    .values({
      id: conversationId,
      type: "dm",
      name: null,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: null
    })
    .run();

  const memberIds = userId === otherUserId ? [userId] : [userId, otherUserId];
  db.insert(threadMembers)
    .values(memberIds.map((memberId) => ({
      conversationId,
      userId: memberId,
      role: "member" as const,
      createdAt: now
    })))
    .run();

  return {
    id: conversationId,
    type: "dm",
    otherUser: userId === otherUserId ? currentUser : otherUser,
    lastMessageAt: null,
    lastMessagePreview: null,
    unreadMentions: 0
  };
}

export function listThreadMessages(userId: string, conversationId: string, params: ThreadMessageListParams): ThreadMessageSummary[] {
  const conversation = getConversation(conversationId);
  assertConversationMember(userId, conversationId);

  if (conversation.type === "dm") {
    assertConversationPermission(userId, conversationId, "dm_read");
  } else {
    assertConversationPermission(userId, conversationId, "channel_read");
  }

  const limit = params.limit ?? 50;
  const cursor = params.cursor;

  const conditions = [eq(threadMessages.conversationId, conversationId), isNull(threadMessages.deletedAt)];
  if (cursor) {
    conditions.push(lt(threadMessages.createdAt, new Date(cursor)));
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

  const messageIds = rows.map((row) => row.id);
  const reactionsByMessageId = getThreadMessageReactions(messageIds);
  const replyCounts = getThreadReplyCounts(messageIds);
  const attachmentsByMessageId = getThreadAttachmentsForMessages(messageIds);

  const summaries = rows.map((row) => {
    let body = row.body;
    if (conversation.type === "dm" && row.bodyEncrypted) {
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
      reactions: reactionsByMessageId.get(row.id) ?? [],
      replyCount: replyCounts.get(row.id) ?? 0,
      attachments: attachmentsByMessageId.get(row.id) ?? []
    };
  });

  return summaries.reverse();
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
  if (!trimmed) {
    throw new ApiError(400, "Message body cannot be empty");
  }

  let body: string | null = trimmed;
  let bodyEncrypted: string | null = null;
  let encryptionVersion = 1;

  if (conversation.type === "dm") {
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
    body: conversation.type === "dm" ? trimmed : body,
    isForwarded: Boolean(input.forwarded),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reactions: [],
    replyCount: 0,
    attachments: []
  };
}

export function listThreadReplies(userId: string, messageId: string): ThreadReplySummary[] {
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
    .where(and(eq(threadReplies.parentMessageId, messageId), isNull(threadReplies.deletedAt)))
    .orderBy(threadReplies.createdAt)
    .all();

  const replyIds = rows.map((row) => row.id);
  const reactionsByReplyId = getThreadReplyReactions(replyIds);

  return rows.map((row) => {
    let body = row.body;
    if (conversation.type === "dm" && row.bodyEncrypted) {
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
      reactions: reactionsByReplyId.get(row.id) ?? []
    };
  });
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
    throw new ApiError(400, "Channels are not available yet");
  }

  const trimmed = input.body.trim();
  if (!trimmed) {
    throw new ApiError(400, "Reply body cannot be empty");
  }

  let body: string | null = trimmed;
  let bodyEncrypted: string | null = null;
  let encryptionVersion = 1;

  if (conversation.type === "dm") {
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

  const replyMentions = input.mentions?.filter((mentionId) => mentionId !== userId);
  storeThreadReplyMentions(conversation.id, replyId, replyMentions);

  const author = ensureUserExists(userId);
  return {
    id: replyId,
    parentMessageId: messageId,
    author,
    body: conversation.type === "dm" ? trimmed : body,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reactions: []
  };
}



















export async function createThreadAttachments(
  userId: string,
  messageId: string,
  files: Express.Multer.File[]
): Promise<ThreadAttachment[]> {
  const message = db
    .select({ id: threadMessages.id, conversationId: threadMessages.conversationId })
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

    db.insert(threadAttachments)
      .values({
        id: attachmentId,
        messageId,
        originalName,
        mimeType: file.mimetype ?? null,
        size: file.size ?? 0,
        storagePath,
        createdAt: now
      })
      .run();

    created.push({
      id: attachmentId,
      messageId,
      originalName,
      mimeType: file.mimetype ?? null,
      size: file.size ?? 0,
      createdAt: now
    });
  }

  return created;
}

export function getThreadAttachmentDownloadInfo(attachmentId: string): { filePath: string; originalName: string } {
  const attachment = getThreadAttachmentRecord(attachmentId);
  return {
    filePath: resolveThreadAttachmentPath(attachment.storagePath),
    originalName: attachment.originalName
  };
}

export function toggleThreadMessageReaction(userId: string, messageId: string, input: ThreadReactionInput): ThreadReaction[] {
  const message = db
    .select({ id: threadMessages.id, conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .get();

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  getConversation(message.conversationId);
  assertConversationMember(userId, message.conversationId);
  assertPermission(userId, "react", { scopeType: "section", scopeId: message.conversationId });

  const existing = db
    .select({ messageId: threadMessageReactions.messageId })
    .from(threadMessageReactions)
    .where(and(
      eq(threadMessageReactions.messageId, messageId),
      eq(threadMessageReactions.userId, userId),
      eq(threadMessageReactions.emoji, input.emoji)
    ))
    .limit(1)
    .get();

  if (existing) {
    db.delete(threadMessageReactions)
      .where(and(
        eq(threadMessageReactions.messageId, messageId),
        eq(threadMessageReactions.userId, userId),
        eq(threadMessageReactions.emoji, input.emoji)
      ))
      .run();
  } else {
    db.insert(threadMessageReactions)
      .values({
        messageId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .run();
  }

  return getThreadMessageReactions([messageId]).get(messageId) ?? [];
}

export function toggleThreadReplyReaction(userId: string, replyId: string, input: ThreadReactionInput): ThreadReaction[] {
  const reply = db
    .select({ id: threadReplies.id, conversationId: threadMessages.conversationId })
    .from(threadReplies)
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .where(eq(threadReplies.id, replyId))
    .get();

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  getConversation(reply.conversationId);
  assertConversationMember(userId, reply.conversationId);
  assertPermission(userId, "react", { scopeType: "section", scopeId: reply.conversationId });

  const existing = db
    .select({ replyId: threadReplyReactions.replyId })
    .from(threadReplyReactions)
    .where(and(
      eq(threadReplyReactions.replyId, replyId),
      eq(threadReplyReactions.userId, userId),
      eq(threadReplyReactions.emoji, input.emoji)
    ))
    .limit(1)
    .get();

  if (existing) {
    db.delete(threadReplyReactions)
      .where(and(
        eq(threadReplyReactions.replyId, replyId),
        eq(threadReplyReactions.userId, userId),
        eq(threadReplyReactions.emoji, input.emoji)
      ))
      .run();
  } else {
    db.insert(threadReplyReactions)
      .values({
        replyId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .run();
  }

  return getThreadReplyReactions([replyId]).get(replyId) ?? [];
}






