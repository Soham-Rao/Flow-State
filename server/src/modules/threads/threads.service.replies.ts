import crypto from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { threadMessages, threadReplies, users } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody, encryptDmBody } from "../../utils/encryption.js";
import type { CreateThreadReplyInput } from "./threads.schema.js";
import type { ThreadReplySummary } from "./threads.service.types.js";
import { assertConversationMember, assertConversationPermission, ensureUserExists, getConversation } from "./threads.service.access.js";
import { storeThreadReplyMentions } from "./threads.service.mentions.js";
import { getThreadReplyReactions } from "./threads.service.data.js";

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

  const replyMentions = input.mentions?.filter((mentionId) => mentionId !== userId);
  storeThreadReplyMentions(conversation.id, replyId, replyMentions);

  const author = ensureUserExists(userId);
  return {
    id: replyId,
    parentMessageId: messageId,
    author,
    body: conversation.type === "dm" ? (trimmed || null) : body,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reactions: []
  };
}
