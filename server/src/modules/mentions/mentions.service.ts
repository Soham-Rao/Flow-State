import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db, sqlite } from "../../db/connection.js";
import {
  commentMentions,
  comments,
  threadMentions,
  threadMessages,
  threadReplyMentions,
  threadReplies,
  threadMembers
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";

export interface MentionUnreadCounts {
  total: number;
  threads: number;
  comments: number;
}

function cleanupInvalidThreadMentions(userId: string): void {
  sqlite
    .prepare(`
      DELETE FROM thread_mentions
      WHERE mentioned_user_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM thread_messages tm
          INNER JOIN thread_members m
            ON m.conversation_id = tm.conversation_id
           AND m.user_id = thread_mentions.mentioned_user_id
          WHERE tm.id = thread_mentions.message_id
        )
    `)
    .run(userId);

  sqlite
    .prepare(`
      DELETE FROM thread_reply_mentions
      WHERE mentioned_user_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM thread_replies tr
          INNER JOIN thread_messages tm ON tr.parent_message_id = tm.id
          INNER JOIN thread_members m
            ON m.conversation_id = tm.conversation_id
           AND m.user_id = thread_reply_mentions.mentioned_user_id
          WHERE tr.id = thread_reply_mentions.reply_id
        )
    `)
    .run(userId);
}

export function getUnreadMentions(userId: string): MentionUnreadCounts {
  cleanupInvalidThreadMentions(userId);
  const commentCount = db
    .select({ count: sql<number>`count(*)` })
    .from(commentMentions)
    .innerJoin(comments, eq(commentMentions.commentId, comments.id))
    .where(
      and(
        eq(commentMentions.userId, userId),
        isNull(commentMentions.seenAt),
        ne(comments.authorId, commentMentions.userId)
      )
    )
    .get();

  const threadMessageCount = db
    .select({ count: sql<number>`count(*)` })
    .from(threadMentions)
    .innerJoin(threadMessages, eq(threadMentions.messageId, threadMessages.id))
    .innerJoin(threadMembers, and(eq(threadMembers.conversationId, threadMessages.conversationId), eq(threadMembers.userId, threadMentions.mentionedUserId)))
    .where(
      and(
        eq(threadMentions.mentionedUserId, userId),
        isNull(threadMentions.seenAt),
        ne(threadMessages.authorId, threadMentions.mentionedUserId)
      )
    )
    .get();

  const threadReplyCount = db
    .select({ count: sql<number>`count(*)` })
    .from(threadReplyMentions)
    .innerJoin(threadReplies, eq(threadReplyMentions.replyId, threadReplies.id))
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .innerJoin(threadMembers, and(eq(threadMembers.conversationId, threadMessages.conversationId), eq(threadMembers.userId, threadReplyMentions.mentionedUserId)))
    .where(
      and(
        eq(threadReplyMentions.mentionedUserId, userId),
        isNull(threadReplyMentions.seenAt),
        ne(threadReplies.authorId, threadReplyMentions.mentionedUserId)
      )
    )
    .get();

  const threads = (threadMessageCount?.count ?? 0) + (threadReplyCount?.count ?? 0);
  const commentTotal = commentCount?.count ?? 0;

  return {
    total: threads + commentTotal,
    threads,
    comments: commentTotal
  };
}

export function markCommentMentionsSeen(userId: string, commentIds: string[]): void {
  if (commentIds.length === 0) {
    return;
  }

  db.update(commentMentions)
    .set({ seenAt: new Date() })
    .where(and(eq(commentMentions.userId, userId), inArray(commentMentions.commentId, commentIds), isNull(commentMentions.seenAt)))
    .run();
}

export function markThreadMentionsSeen(userId: string, conversationId: string): void {
  const membership = db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .get();

  if (!membership) {
    throw new ApiError(403, "You do not have access to this conversation");
  }

  const now = Date.now();
  sqlite
    .prepare(`
      UPDATE thread_mentions
      SET seen_at = ?
      WHERE mentioned_user_id = ?
        AND seen_at IS NULL
        AND message_id IN (SELECT id FROM thread_messages WHERE conversation_id = ?)
    `)
    .run(now, userId, conversationId);

  sqlite
    .prepare(`
      UPDATE thread_reply_mentions
      SET seen_at = ?
      WHERE mentioned_user_id = ?
        AND seen_at IS NULL
        AND reply_id IN (
          SELECT tr.id
          FROM thread_replies tr
          INNER JOIN thread_messages tm ON tr.parent_message_id = tm.id
          WHERE tm.conversation_id = ?
        )
    `)
    .run(now, userId, conversationId);
}

export function listCommentMentions(userId: string): Array<{ commentId: string }> {
  return db
    .select({ commentId: commentMentions.commentId })
    .from(commentMentions)
    .where(and(eq(commentMentions.userId, userId), isNull(commentMentions.seenAt)))
    .all();
}








