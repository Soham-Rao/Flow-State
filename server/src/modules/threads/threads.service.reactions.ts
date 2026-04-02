import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { emitThreadEvent } from "../../realtime/socket.js";
import { threadMessageReactions, threadMessages, threadReplyReactions, threadReplies } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertPermission } from "../../utils/permissions.js";
import type { ThreadReaction } from "./threads.service.types.js";
import type { ThreadReactionInput } from "./threads.schema.js";
import { assertConversationMember, getConversation } from "./threads.service.access.js";
import { getThreadMessageReactions, getThreadReplyReactions } from "./threads.service.data.js";

export async function toggleThreadMessageReaction(userId: string, messageId: string, input: ThreadReactionInput): Promise<ThreadReaction[]> {
  const messageRows = await db
    .select({ id: threadMessages.id, conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, messageId))
    .limit(1);

  const message = messageRows[0];

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  await getConversation(message.conversationId);
  await assertConversationMember(userId, message.conversationId);
  await assertPermission(userId, "react", { scopeType: "section", scopeId: message.conversationId });

  const existingRows = await db
    .select({ messageId: threadMessageReactions.messageId })
    .from(threadMessageReactions)
    .where(and(
      eq(threadMessageReactions.messageId, messageId),
      eq(threadMessageReactions.userId, userId),
      eq(threadMessageReactions.emoji, input.emoji)
    ))
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    await db.delete(threadMessageReactions)
      .where(and(
        eq(threadMessageReactions.messageId, messageId),
        eq(threadMessageReactions.userId, userId),
        eq(threadMessageReactions.emoji, input.emoji)
      ))
      .execute();
  } else {
    await db.insert(threadMessageReactions)
      .values({
        messageId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .execute();
  }

  emitThreadEvent(message.conversationId, "threads:reaction", { conversationId: message.conversationId });
  return (await getThreadMessageReactions([messageId])).get(messageId) ?? [];
}

export async function toggleThreadReplyReaction(userId: string, replyId: string, input: ThreadReactionInput): Promise<ThreadReaction[]> {
  const replyRows = await db
    .select({ id: threadReplies.id, conversationId: threadMessages.conversationId })
    .from(threadReplies)
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .where(eq(threadReplies.id, replyId))
    .limit(1);

  const reply = replyRows[0];

  if (!reply) {
    throw new ApiError(404, "Reply not found");
  }

  await getConversation(reply.conversationId);
  await assertConversationMember(userId, reply.conversationId);
  await assertPermission(userId, "react", { scopeType: "section", scopeId: reply.conversationId });

  const existingRows = await db
    .select({ replyId: threadReplyReactions.replyId })
    .from(threadReplyReactions)
    .where(and(
      eq(threadReplyReactions.replyId, replyId),
      eq(threadReplyReactions.userId, userId),
      eq(threadReplyReactions.emoji, input.emoji)
    ))
    .limit(1);

  const existing = existingRows[0];

  if (existing) {
    await db.delete(threadReplyReactions)
      .where(and(
        eq(threadReplyReactions.replyId, replyId),
        eq(threadReplyReactions.userId, userId),
        eq(threadReplyReactions.emoji, input.emoji)
      ))
      .execute();
  } else {
    await db.insert(threadReplyReactions)
      .values({
        replyId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .execute();
  }

  emitThreadEvent(reply.conversationId, "threads:reaction", { conversationId: reply.conversationId });
  return (await getThreadReplyReactions([replyId])).get(replyId) ?? [];
}
