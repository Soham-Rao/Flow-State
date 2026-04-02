import crypto from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { threadMembers, threadMentions, threadReplyMentions, users } from "../../db/schema.js";

function normalizeMentions(mentions: string[] | undefined): string[] {
  if (!mentions || mentions.length === 0) {
    return [];
  }
  return Array.from(new Set(mentions));
}

export async function storeThreadMentions(
  conversationId: string,
  messageId: string,
  mentions: string[] | undefined,
  authorId: string
): Promise<void> {
  const uniqueMentions = normalizeMentions(mentions).filter((mentionId) => mentionId !== authorId);
  if (uniqueMentions.length === 0) {
    return;
  }

  const existingUsers: Array<{ id: string }> = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueMentions));

  if (existingUsers.length === 0) {
    return;
  }

  const allowedRows: Array<{ userId: string }> = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(
      eq(threadMembers.conversationId, conversationId),
      inArray(threadMembers.userId, existingUsers.map((user) => user.id))
    ));

  const allowed = allowedRows.map((row) => row.userId)
    .filter((userId) => userId !== authorId);

  if (allowed.length === 0) {
    return;
  }

  const now = new Date();
  await db.insert(threadMentions)
    .values(allowed.map((userId) => ({
      id: crypto.randomUUID(),
      messageId,
      mentionedUserId: userId,
      createdAt: now,
      seenAt: null
    })))
    .execute();

  await Promise.all(allowed.map((mentionedUserId) => recordActivity({
    type: "mention.thread",
    actorId: authorId,
    threadConversationId: conversationId,
    threadMessageId: messageId,
    mentionedUserId,
    metadata: { source: "message" }
  })));
}

export async function storeThreadReplyMentions(
  conversationId: string,
  replyId: string,
  mentions: string[] | undefined,
  authorId: string
): Promise<void> {
  const uniqueMentions = normalizeMentions(mentions).filter((mentionId) => mentionId !== authorId);
  if (uniqueMentions.length === 0) {
    return;
  }

  const existingUsers: Array<{ id: string }> = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueMentions));

  if (existingUsers.length === 0) {
    return;
  }

  const allowedRows: Array<{ userId: string }> = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(
      eq(threadMembers.conversationId, conversationId),
      inArray(threadMembers.userId, existingUsers.map((user) => user.id))
    ));

  const allowed = allowedRows.map((row) => row.userId)
    .filter((userId) => userId !== authorId);

  if (allowed.length === 0) {
    return;
  }

  const now = new Date();
  await db.insert(threadReplyMentions)
    .values(allowed.map((userId) => ({
      id: crypto.randomUUID(),
      replyId,
      mentionedUserId: userId,
      createdAt: now,
      seenAt: null
    })))
    .execute();

  await Promise.all(allowed.map((mentionedUserId) => recordActivity({
    type: "mention.thread",
    actorId: authorId,
    threadConversationId: conversationId,
    threadReplyId: replyId,
    mentionedUserId,
    metadata: { source: "reply" }
  })));
}
