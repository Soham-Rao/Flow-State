import crypto from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { threadMembers, threadMentions, threadReplyMentions, users } from "../../db/schema.js";

function normalizeMentions(mentions: string[] | undefined): string[] {
  if (!mentions || mentions.length === 0) {
    return [];
  }
  return Array.from(new Set(mentions));
}

export function storeThreadMentions(conversationId: string, messageId: string, mentions: string[] | undefined): void {
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
    .where(and(
      eq(threadMembers.conversationId, conversationId),
      inArray(threadMembers.userId, existingUsers.map((user) => user.id))
    ))
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

export function storeThreadReplyMentions(conversationId: string, replyId: string, mentions: string[] | undefined): void {
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
    .where(and(
      eq(threadMembers.conversationId, conversationId),
      inArray(threadMembers.userId, existingUsers.map((user) => user.id))
    ))
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
