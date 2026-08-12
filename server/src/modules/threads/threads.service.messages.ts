import crypto from "node:crypto";
import fs from "node:fs/promises";

import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { emitThreadEvent } from "../../realtime/socket.js";
import {
  threadAttachments,
  threadConversations,
  threadMembers,
  threadMessageDeletions,
  threadMessageReactions,
  threadMessages,
  threadReplies,
  threadMentions,
  threadVoiceNotes,
  users,
  workspaceMemberships,
  type UserRole
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { sanitizePlainText } from "../../utils/sanitize.js";
import { decryptDmBody, encryptDmBody } from "../../utils/encryption.js";
import { assertPermission } from "../../utils/permissions.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";
import type {
  CreateThreadMessageInput,
  DeleteThreadMessageInput,
  ThreadMessageListParams,
  UpdateThreadMessageInput
} from "./threads.schema.js";
import type { ThreadMessageSummary, ThreadReactionDetail, ThreadReplyContext, ThreadUserSummary } from "./threads.service.types.js";
import { assertConversationMember, assertConversationPermission, ensureUserExists, getConversation } from "./threads.service.access.js";
import { storeThreadMentions } from "./threads.service.mentions.js";
import {
  getThreadAttachmentsForMessages,
  getThreadMessageDeletionSet,
  getThreadMessageReactions,
  getThreadReplyCounts,
  getThreadReplyMentionCounts,
  getThreadVoiceNotesForMessages
} from "./threads.service.data.js";
import { resolveThreadAttachmentPath, resolveThreadVoiceNotePath } from "./threads.service.storage.js";

type ThreadMessageRow = {
  id: string;
  conversationId: string;
  replyToMessageId: string | null;
  replyToReplyId: string | null;
  body: string | null;
  bodyEncrypted: string | null;
  encryptionVersion: number;
  isForwarded: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  authorId: string;
  authorName: string;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorEmail: string;
  authorBio: string | null;
  authorRole: UserRole;
};

type ThreadReactionRow = {
  emoji: string;
  userId: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  bio: string | null;
  role: UserRole;
};
type ReplyContextRow = {
  id: string;
  body: string | null;
  bodyEncrypted: string | null;
  encryptionVersion: number;
  createdAt: Date;
  deletedAt: Date | null;
  authorId: string;
  authorName: string;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorEmail: string;
  authorBio: string | null;
  authorRole: UserRole;
};

const mapReplyContextRow = (
  row: ReplyContextRow,
  conversationType: "dm" | "channel",
  kind: "message" | "reply"
): ThreadReplyContext => {
  let body = row.body;
  if (row.deletedAt) {
    body = "This message was deleted.";
  } else if (conversationType === "dm" && row.bodyEncrypted) {
    body = decryptDmBody(row.bodyEncrypted, row.encryptionVersion);
  }
  return {
    id: row.id,
    kind,
    author: {
      id: row.authorId,
      name: row.authorName,
      displayName: row.authorDisplayName,
      username: row.authorUsername,
      email: row.authorEmail,
      bio: row.authorBio,
      role: row.authorRole
    },
    body,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt
  };
};

const loadReplyContextMaps = async (
  conversationType: "dm" | "channel",
  conversationId: string,
  replyToMessageIds: string[],
  replyToReplyIds: string[]
): Promise<{ messageMap: Map<string, ThreadReplyContext>; replyMap: Map<string, ThreadReplyContext> }> => {
  const messageMap = new Map<string, ThreadReplyContext>();
  const replyMap = new Map<string, ThreadReplyContext>();

  if (replyToMessageIds.length > 0) {
    const rows: ReplyContextRow[] = await db
      .select({
        id: threadMessages.id,
        body: threadMessages.body,
        bodyEncrypted: threadMessages.bodyEncrypted,
        encryptionVersion: threadMessages.encryptionVersion,
        createdAt: threadMessages.createdAt,
        deletedAt: threadMessages.deletedAt,
        authorId: users.id,
        authorName: users.name,
        authorDisplayName: users.displayName,
        authorUsername: users.username,
        authorEmail: users.email,
        authorBio: users.bio,
        authorRole: workspaceMemberships.role
      })
      .from(threadMessages)
      .innerJoin(users, eq(threadMessages.authorId, users.id))
      .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
      .where(and(inArray(threadMessages.id, replyToMessageIds), eq(threadMessages.conversationId, conversationId)));

    rows.forEach((row) => {
      messageMap.set(row.id, mapReplyContextRow(row, conversationType, "message"));
    });
  }

  if (replyToReplyIds.length > 0) {
    const rows: ReplyContextRow[] = await db
      .select({
        id: threadReplies.id,
        body: threadReplies.body,
        bodyEncrypted: threadReplies.bodyEncrypted,
        encryptionVersion: threadReplies.encryptionVersion,
        createdAt: threadReplies.createdAt,
        deletedAt: threadReplies.deletedAt,
        authorId: users.id,
        authorName: users.name,
        authorDisplayName: users.displayName,
        authorUsername: users.username,
        authorEmail: users.email,
        authorBio: users.bio,
        authorRole: workspaceMemberships.role
      })
      .from(threadReplies)
      .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
      .innerJoin(users, eq(threadReplies.authorId, users.id))
      .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
      .where(and(inArray(threadReplies.id, replyToReplyIds), eq(threadMessages.conversationId, conversationId)));

    rows.forEach((row) => {
      replyMap.set(row.id, mapReplyContextRow(row, conversationType, "reply"));
    });
  }

  return { messageMap, replyMap };
};

export async function listThreadMessages(
  userId: string,
  conversationId: string,
  params: ThreadMessageListParams = {}
): Promise<ThreadMessageSummary[]> {
  const conversation = await getConversation(conversationId);
  await assertConversationMember(userId, conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, conversationId, "dm_read");
  } else {
    await assertConversationPermission(userId, conversationId, "channel_read");
  }

  const limit = Math.min(params.limit ?? 50, 80);
  const conditions = [eq(threadMessages.conversationId, conversationId)];
  if (params.cursor) {
    conditions.push(lt(threadMessages.createdAt, new Date(params.cursor)));
  }

  const rows: ThreadMessageRow[] = await db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      replyToMessageId: threadMessages.replyToMessageId,
      replyToReplyId: threadMessages.replyToReplyId,
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
      authorBio: users.bio,
      authorRole: workspaceMemberships.role
    })
    .from(threadMessages)
    .innerJoin(users, eq(threadMessages.authorId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(and(...conditions))
    .orderBy(desc(threadMessages.createdAt))
    .limit(limit);

  const now = new Date();
  await db.update(threadMembers)
    .set({ lastReadAt: now })
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .execute();

  const messageIds = rows.map((row) => row.id);
  const deletedForUser = await getThreadMessageDeletionSet(userId, messageIds);
  const filteredRows = rows.filter((row) => !deletedForUser.has(row.id));
  const visibleIds = filteredRows.map((row) => row.id);
  const replyToMessageIds = Array.from(
    new Set(filteredRows.map((row) => row.replyToMessageId).filter((value): value is string => Boolean(value)))
  );
  const replyToReplyIds = Array.from(
    new Set(filteredRows.map((row) => row.replyToReplyId).filter((value): value is string => Boolean(value)))
  );

  const { messageMap: replyMessageMap, replyMap: replyReplyMap } = await loadReplyContextMaps(
    conversation.type,
    conversationId,
    replyToMessageIds,
    replyToReplyIds
  );

  const [reactionsByMessageId, replyCounts, replyMentionCounts, attachmentsByMessageId, voiceNotesByMessageId] = await Promise.all([
    getThreadMessageReactions(visibleIds),
    getThreadReplyCounts(visibleIds, userId),
    getThreadReplyMentionCounts(visibleIds, userId),
    getThreadAttachmentsForMessages(visibleIds),
    getThreadVoiceNotesForMessages(visibleIds)
  ]);

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
      replyToMessageId: row.replyToMessageId ?? null,
      replyToReplyId: row.replyToReplyId ?? null,
      replyContext: row.replyToMessageId
        ? replyMessageMap.get(row.replyToMessageId) ?? null
        : row.replyToReplyId
          ? replyReplyMap.get(row.replyToReplyId) ?? null
          : null,
      author: {
        id: row.authorId,
        name: row.authorName,
        displayName: row.authorDisplayName,
        username: row.authorUsername,
        email: row.authorEmail,
        bio: row.authorBio,
        role: row.authorRole
      },
      body,
      isForwarded: Boolean(row.isForwarded),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      reactions: isDeleted ? [] : reactionsByMessageId.get(row.id) ?? [],
      replyCount: isDeleted ? 0 : replyCounts.get(row.id) ?? 0,
      unreadReplyMentions: isDeleted ? 0 : replyMentionCounts.get(row.id) ?? 0,
      attachments: isDeleted ? [] : attachmentsByMessageId.get(row.id) ?? [],
      voiceNote: isDeleted ? null : voiceNotesByMessageId.get(row.id) ?? null
    };
  });

  return summaries.reverse();
}

export async function listThreadMessageReactionDetails(userId: string, messageId: string): Promise<ThreadReactionDetail[]> {
  const messageRows = await db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      deletedAt: threadMessages.deletedAt,
      authorId: threadMessages.authorId,
      createdAt: threadMessages.createdAt,
      isForwarded: threadMessages.isForwarded,
      encryptionVersion: threadMessages.encryptionVersion,
      replyToMessageId: threadMessages.replyToMessageId,
      replyToReplyId: threadMessages.replyToReplyId
    })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .limit(1);

  const message = messageRows[0];

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  if (message.deletedAt) {
    return [];
  }

  const conversation = await getConversation(message.conversationId);
  await assertConversationMember(userId, message.conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, message.conversationId, "dm_read");
  } else {
    await assertConversationPermission(userId, message.conversationId, "channel_read");
  }

  const rows: ThreadReactionRow[] = await db
    .select({
      emoji: threadMessageReactions.emoji,
      userId: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      bio: users.bio,
      role: workspaceMemberships.role
    })
    .from(threadMessageReactions)
    .innerJoin(users, eq(threadMessageReactions.userId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(eq(threadMessageReactions.messageId, messageId));

  const map = new Map<string, ThreadUserSummary[]>();
  for (const row of rows) {
    const existing = map.get(row.emoji) ?? [];
    existing.push({
      id: row.userId,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      bio: row.bio,
      role: row.role
    });
    map.set(row.emoji, existing);
  }

  return Array.from(map.entries()).map(([emoji, users]) => ({ emoji, users }));
}

export async function createThreadMessage(userId: string, conversationId: string, input: CreateThreadMessageInput): Promise<ThreadMessageSummary> {
  const conversation = await getConversation(conversationId);
  await assertConversationMember(userId, conversationId);

  if (conversation.type === "dm") {
    await assertConversationPermission(userId, conversationId, "dm_write");
  } else {
    await assertConversationPermission(userId, conversationId, "channel_write");
  }

  const replyToMessageId = input.replyToMessageId ?? null;
  const replyToReplyId = input.replyToReplyId ?? null;

  if (replyToMessageId) {
    const rows = await db
      .select({ id: threadMessages.id })
      .from(threadMessages)
      .where(and(eq(threadMessages.id, replyToMessageId), eq(threadMessages.conversationId, conversationId)))
      .limit(1);
    if (!rows[0]) {
      throw new ApiError(400, "Reply target not found");
    }
  }

  if (replyToReplyId) {
    const rows = await db
      .select({ id: threadReplies.id })
      .from(threadReplies)
      .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
      .where(and(eq(threadReplies.id, replyToReplyId), eq(threadMessages.conversationId, conversationId)))
      .limit(1);
    if (!rows[0]) {
      throw new ApiError(400, "Reply target not found");
    }
  }

  const trimmed = sanitizePlainText(input.body);
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
  await db.insert(threadMessages)
    .values({
      id: messageId,
      conversationId,
      authorId: userId,
      replyToMessageId,
      replyToReplyId,
      body,
      bodyEncrypted,
      bodyFormat: "plain",
      encryptionVersion,
      isForwarded: Boolean(input.forwarded),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    .execute();

  await db.update(threadConversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(threadConversations.id, conversationId))
    .execute();

  await storeThreadMentions(conversationId, messageId, input.mentions, userId);
  const { messageMap: createdReplyMessageMap, replyMap: createdReplyMap } = await loadReplyContextMaps(
    conversation.type,
    conversationId,
    replyToMessageId ? [replyToMessageId] : [],
    replyToReplyId ? [replyToReplyId] : []
  );
  const replyContext = replyToMessageId
    ? createdReplyMessageMap.get(replyToMessageId) ?? null
    : replyToReplyId
      ? createdReplyMap.get(replyToReplyId) ?? null
      : null;

  const author = await ensureUserExists(userId);
  const summary = {
    id: messageId,
    conversationId,
    replyToMessageId,
    replyToReplyId,
    replyContext,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    isForwarded: Boolean(input.forwarded),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reactions: [],
    replyCount: 0,
    unreadReplyMentions: 0,
    attachments: [],
    voiceNote: null
  };
  emitThreadEvent(conversationId, "threads:message:new", { conversationId });
  return summary;
}

export async function updateThreadMessage(userId: string, messageId: string, input: UpdateThreadMessageInput): Promise<ThreadMessageSummary> {
  const messageRows = await db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      deletedAt: threadMessages.deletedAt,
      authorId: threadMessages.authorId,
      createdAt: threadMessages.createdAt,
      isForwarded: threadMessages.isForwarded,
      encryptionVersion: threadMessages.encryptionVersion,
      replyToMessageId: threadMessages.replyToMessageId,
      replyToReplyId: threadMessages.replyToReplyId
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

  const trimmed = sanitizePlainText(input.body);
  if (!trimmed) {
    const attachmentRows = await db
      .select({ id: threadAttachments.id })
      .from(threadAttachments)
      .where(eq(threadAttachments.messageId, messageId))
      .limit(1);
    const voiceRows = await db
      .select({ id: threadVoiceNotes.id })
      .from(threadVoiceNotes)
      .where(eq(threadVoiceNotes.messageId, messageId))
      .limit(1);
    const hasAttachment = attachmentRows[0];
    const hasVoice = voiceRows[0];
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

  await db.update(threadMessages)
    .set({ body, bodyEncrypted, encryptionVersion, updatedAt: now })
    .where(eq(threadMessages.id, messageId))
    .execute();

  const { messageMap: updatedReplyMessageMap, replyMap: updatedReplyMap } = await loadReplyContextMaps(
    conversation.type,
    message.conversationId,
    message.replyToMessageId ? [message.replyToMessageId] : [],
    message.replyToReplyId ? [message.replyToReplyId] : []
  );
  const replyContext = message.replyToMessageId
    ? updatedReplyMessageMap.get(message.replyToMessageId) ?? null
    : message.replyToReplyId
      ? updatedReplyMap.get(message.replyToReplyId) ?? null
      : null;

  const author = await ensureUserExists(userId);
  const [reactionsByMessageId, replyCounts, attachmentsByMessageId, voiceNotesByMessageId] = await Promise.all([
    getThreadMessageReactions([messageId]),
    getThreadReplyCounts([messageId], userId),
    getThreadAttachmentsForMessages([messageId]),
    getThreadVoiceNotesForMessages([messageId])
  ]);

  const summary = {
    id: messageId,
    conversationId: message.conversationId,
    replyToMessageId: message.replyToMessageId ?? null,
    replyToReplyId: message.replyToReplyId ?? null,
    replyContext,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    isForwarded: Boolean(message.isForwarded),
    createdAt: message.createdAt,
    updatedAt: now,
    deletedAt: null,
    reactions: reactionsByMessageId.get(messageId) ?? [],
    replyCount: replyCounts.get(messageId) ?? 0,
    unreadReplyMentions: 0,
    attachments: attachmentsByMessageId.get(messageId) ?? [],
    voiceNote: voiceNotesByMessageId.get(messageId) ?? null
  };
  emitThreadEvent(message.conversationId, "threads:message:edit", { conversationId: message.conversationId });
  return summary;
}

export async function deleteThreadMessage(
  userId: string,
  messageId: string,
  scope: DeleteThreadMessageInput["scope"]
): Promise<{ id: string; scope: "me" | "all"; message?: ThreadMessageSummary }> {
  const messageRows = await db
    .select({
      id: threadMessages.id,
      conversationId: threadMessages.conversationId,
      deletedAt: threadMessages.deletedAt,
      authorId: threadMessages.authorId,
      createdAt: threadMessages.createdAt,
      isForwarded: threadMessages.isForwarded,
      encryptionVersion: threadMessages.encryptionVersion,
      replyToMessageId: threadMessages.replyToMessageId,
      replyToReplyId: threadMessages.replyToReplyId
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

  if (scope === "all") {
    await assertPermission(userId, "delete_threads");
  }

  if (scope === "me") {
    try {
      await db.insert(threadMessageDeletions)
        .values({
          messageId,
          userId,
          deletedAt: new Date()
        })
        .execute();
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

  const otherMembers: Array<{ userId: string; lastReadAt: Date | null }> = await db
    .select({ userId: threadMembers.userId, lastReadAt: threadMembers.lastReadAt })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, message.conversationId), ne(threadMembers.userId, userId)));

  const seenByOthers = otherMembers.some((member) => {
    if (!member.lastReadAt) return false;
    return member.lastReadAt.getTime() >= message.createdAt.getTime();
  });

  if (seenByOthers) {
    throw new ApiError(400, "Cannot delete for all after it was seen");
  }

  const now = new Date();

  const attachments: Array<{ id: string; storagePath: string }> = await db
    .select({ id: threadAttachments.id, storagePath: threadAttachments.storagePath })
    .from(threadAttachments)
    .where(eq(threadAttachments.messageId, messageId));

  const voiceNotes: Array<{ id: string; storagePath: string }> = await db
    .select({ id: threadVoiceNotes.id, storagePath: threadVoiceNotes.storagePath })
    .from(threadVoiceNotes)
    .where(eq(threadVoiceNotes.messageId, messageId));

  await db.delete(threadMessageReactions)
    .where(eq(threadMessageReactions.messageId, messageId))
    .execute();
  await db.delete(threadMentions)
    .where(eq(threadMentions.messageId, messageId))
    .execute();
  await db.delete(threadMessageDeletions)
    .where(eq(threadMessageDeletions.messageId, messageId))
    .execute();
  await db.delete(threadAttachments)
    .where(eq(threadAttachments.messageId, messageId))
    .execute();
  await db.delete(threadVoiceNotes)
    .where(eq(threadVoiceNotes.messageId, messageId))
    .execute();

  for (const attachment of attachments) {
    const filePath = resolveThreadAttachmentPath(attachment.storagePath);
    void fs.rm(filePath, { force: true }).catch(() => {});
  }
  for (const voiceNote of voiceNotes) {
    const filePath = resolveThreadVoiceNotePath(voiceNote.storagePath);
    void fs.rm(filePath, { force: true }).catch(() => {});
  }

  await db.update(threadMessages)
    .set({
      body: null,
      bodyEncrypted: null,
      updatedAt: now,
      deletedAt: now
    })
    .where(eq(threadMessages.id, messageId))
    .execute();

  const { messageMap: updatedReplyMessageMap, replyMap: updatedReplyMap } = await loadReplyContextMaps(
    conversation.type,
    message.conversationId,
    message.replyToMessageId ? [message.replyToMessageId] : [],
    message.replyToReplyId ? [message.replyToReplyId] : []
  );
  const replyContext = message.replyToMessageId
    ? updatedReplyMessageMap.get(message.replyToMessageId) ?? null
    : message.replyToReplyId
      ? updatedReplyMap.get(message.replyToReplyId) ?? null
      : null;

  const author = await ensureUserExists(userId);
  const summary = {
    id: messageId,
    conversationId: message.conversationId,
    replyToMessageId: message.replyToMessageId ?? null,
    replyToReplyId: message.replyToReplyId ?? null,
    replyContext,
    author,
    body: "This message was deleted.",
    isForwarded: Boolean(message.isForwarded),
    createdAt: message.createdAt,
    updatedAt: now,
    deletedAt: now,
    reactions: [],
    replyCount: 0,
    unreadReplyMentions: 0,
    attachments: [],
    voiceNote: null
  };
  emitThreadEvent(message.conversationId, "threads:message:delete", { conversationId: message.conversationId });
  return {
    id: messageId,
    scope: "all",
    message: summary
  };
}






































