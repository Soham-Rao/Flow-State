import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { threadMessageReactions, threadMessages, threadReplyReactions, threadReplies } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertPermission } from "../../utils/permissions.js";
import type { ThreadReaction } from "./threads.service.types.js";
import type { ThreadReactionInput } from "./threads.schema.js";
import { assertConversationMember, getConversation } from "./threads.service.access.js";
import { getThreadMessageReactions, getThreadReplyReactions } from "./threads.service.data.js";

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
