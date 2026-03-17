import crypto from "node:crypto";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { commentMentions, commentReactions, comments, users } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateCommentInput } from "./boards.schema.js";
import type { BoardComment, BoardMember, CommentReaction, CommentRow } from "./boards.service.types.js";

export function getCommentReactionsForComments(commentIds: string[]): Map<string, CommentReaction[]> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      commentId: commentReactions.commentId,
      emoji: commentReactions.emoji
    })
    .from(commentReactions)
    .where(inArray(commentReactions.commentId, commentIds))
    .all() as Array<{ commentId: string; emoji: string }>;

  const countsByCommentId = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const emojiCounts = countsByCommentId.get(row.commentId) ?? new Map<string, number>();
    emojiCounts.set(row.emoji, (emojiCounts.get(row.emoji) ?? 0) + 1);
    countsByCommentId.set(row.commentId, emojiCounts);
  }

  const reactionsByCommentId = new Map<string, CommentReaction[]>();
  for (const [commentId, emojiCounts] of countsByCommentId) {
    const reactions = Array.from(emojiCounts.entries()).map(([emoji, count]) => ({ emoji, count }));
    reactionsByCommentId.set(commentId, reactions);
  }

  return reactionsByCommentId;
}

export function getCommentMentionsForComments(commentIds: string[]): Map<string, BoardMember[]> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      commentId: commentMentions.commentId,
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(commentMentions)
    .innerJoin(users, eq(commentMentions.userId, users.id))
    .where(inArray(commentMentions.commentId, commentIds))
    .all();

  const mentionsByCommentId = new Map<string, BoardMember[]>();
  for (const row of rows) {
    const list = mentionsByCommentId.get(row.commentId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt
    });
    mentionsByCommentId.set(row.commentId, list);
  }

  return mentionsByCommentId;
}

export function attachCommentRelations(rows: CommentRow[]): BoardComment[] {
  const commentIds = rows.map((row) => row.id);
  const reactionsByCommentId = getCommentReactionsForComments(commentIds);
  const mentionsByCommentId = getCommentMentionsForComments(commentIds);

  return rows.map((row) => ({
    id: row.id,
    boardId: row.boardId,
    listId: row.listId ?? null,
    cardId: row.cardId ?? null,
    author: {
      id: row.authorId,
      name: row.authorName,
      displayName: row.authorDisplayName,
      username: row.authorUsername,
      email: row.authorEmail,
      role: row.authorRole,
      createdAt: row.authorCreatedAt
    },
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reactions: reactionsByCommentId.get(row.id) ?? [],
    mentions: mentionsByCommentId.get(row.id) ?? []
  }));
}

export function getCommentsForBoard(boardId: string): BoardComment[] {
  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.boardId, boardId), isNull(comments.listId), isNull(comments.cardId)))
    .orderBy(asc(comments.createdAt))
    .all() as CommentRow[];

  return attachCommentRelations(rows);
}

export function getCommentsForLists(listIds: string[]): Map<string, BoardComment[]> {
  if (listIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(and(inArray(comments.listId, listIds), isNull(comments.cardId)))
    .orderBy(asc(comments.createdAt))
    .all() as CommentRow[];

  const commentsByListId = new Map<string, BoardComment[]>();
  for (const comment of attachCommentRelations(rows)) {
    if (!comment.listId) continue;
    const list = commentsByListId.get(comment.listId) ?? [];
    list.push(comment);
    commentsByListId.set(comment.listId, list);
  }

  return commentsByListId;
}

export function getCommentsForCards(cardIds: string[]): Map<string, BoardComment[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(inArray(comments.cardId, cardIds))
    .orderBy(asc(comments.createdAt))
    .all() as CommentRow[];

  const commentsByCardId = new Map<string, BoardComment[]>();
  for (const comment of attachCommentRelations(rows)) {
    if (!comment.cardId) continue;
    const list = commentsByCardId.get(comment.cardId) ?? [];
    list.push(comment);
    commentsByCardId.set(comment.cardId, list);
  }

  return commentsByCardId;
}

export function getCommentById(commentId: string): BoardComment {
  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1)
    .all() as CommentRow[];

  if (rows.length === 0) {
    throw new ApiError(404, "Comment not found");
  }

  return attachCommentRelations(rows)[0];
}

export function storeCommentMentions(commentId: string, mentions: string[] | undefined, authorId: string): void {
  if (!mentions || mentions.length === 0) {
    return;
  }

  const uniqueMentions = Array.from(new Set(mentions)).filter((mentionId) => mentionId !== authorId);
  const existingUsers = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueMentions))
    .all();

  if (uniqueMentions.length === 0) {
    return;
  }

  if (existingUsers.length === 0) {
    return;
  }

  db.insert(commentMentions)
    .values(existingUsers.map((user) => ({
      commentId,
      userId: user.id,
      createdAt: new Date(),
      seenAt: null
    })))
    .run();
}

export function createCommentRecord(params: {
  boardId: string;
  listId: string | null;
  cardId: string | null;
  input: CreateCommentInput;
  authorId: string;
}): BoardComment {
  const now = new Date();
  const commentId = crypto.randomUUID();

  db.insert(comments)
    .values({
      id: commentId,
      boardId: params.boardId,
      listId: params.listId,
      cardId: params.cardId,
      authorId: params.authorId,
      body: params.input.body.trim(),
      createdAt: now,
      updatedAt: now
    })
    .run();

  storeCommentMentions(commentId, params.input.mentions, params.authorId);

  return getCommentById(commentId);
}
