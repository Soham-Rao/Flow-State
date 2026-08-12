import crypto from "node:crypto";

import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { commentMentions, commentReactions, comments, users, workspaceMemberships } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { userHasPermission } from "../../utils/permissions.js";
import { clipAuditText, sanitizeRequiredPlainText } from "../../utils/sanitize.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";
import type { CreateCommentInput } from "./boards.schema.js";
import type { BoardComment, BoardMember, CommentReaction, CommentRow } from "./boards.service.types.js";

export async function getCommentReactionsForComments(commentIds: string[]): Promise<Map<string, CommentReaction[]>> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      commentId: commentReactions.commentId,
      emoji: commentReactions.emoji
    })
    .from(commentReactions)
    .where(inArray(commentReactions.commentId, commentIds));

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

export async function getCommentMentionsForComments(commentIds: string[]): Promise<Map<string, BoardMember[]>> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      commentId: commentMentions.commentId,
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      bio: users.bio,
      role: workspaceMemberships.role,
      createdAt: users.createdAt
    })
    .from(commentMentions)
    .innerJoin(users, eq(commentMentions.userId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(inArray(commentMentions.commentId, commentIds));

  const mentionsByCommentId = new Map<string, BoardMember[]>();
  for (const row of rows) {
    const list = mentionsByCommentId.get(row.commentId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      bio: row.bio,
      role: row.role,
      createdAt: row.createdAt
    });
    mentionsByCommentId.set(row.commentId, list);
  }

  return mentionsByCommentId;
}

export async function attachCommentRelations(rows: CommentRow[]): Promise<BoardComment[]> {
  const commentIds = rows.map((row) => row.id);
  const reactionsByCommentId = await getCommentReactionsForComments(commentIds);
  const mentionsByCommentId = await getCommentMentionsForComments(commentIds);

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
      bio: row.authorBio,
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

export async function getCommentsForBoard(boardId: string): Promise<BoardComment[]> {
  const rows = await db
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
      authorBio: users.bio,
      authorRole: workspaceMemberships.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(and(eq(comments.boardId, boardId), isNull(comments.listId), isNull(comments.cardId)))
    .orderBy(asc(comments.createdAt));

  return attachCommentRelations(rows as CommentRow[]);
}

export async function getCommentsForLists(listIds: string[]): Promise<Map<string, BoardComment[]>> {
  if (listIds.length === 0) {
    return new Map();
  }

  const rows = await db
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
      authorBio: users.bio,
      authorRole: workspaceMemberships.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(and(inArray(comments.listId, listIds), isNull(comments.cardId)))
    .orderBy(asc(comments.createdAt));

  const commentsByListId = new Map<string, BoardComment[]>();
  for (const comment of await attachCommentRelations(rows as CommentRow[])) {
    if (!comment.listId) continue;
    const list = commentsByListId.get(comment.listId) ?? [];
    list.push(comment);
    commentsByListId.set(comment.listId, list);
  }

  return commentsByListId;
}

export async function getCommentsForCards(cardIds: string[]): Promise<Map<string, BoardComment[]>> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = await db
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
      authorBio: users.bio,
      authorRole: workspaceMemberships.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(inArray(comments.cardId, cardIds))
    .orderBy(asc(comments.createdAt));

  const commentsByCardId = new Map<string, BoardComment[]>();
  for (const comment of await attachCommentRelations(rows as CommentRow[])) {
    if (!comment.cardId) continue;
    const list = commentsByCardId.get(comment.cardId) ?? [];
    list.push(comment);
    commentsByCardId.set(comment.cardId, list);
  }

  return commentsByCardId;
}

export async function getCommentById(commentId: string): Promise<BoardComment> {
  const rows = await db
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
      authorBio: users.bio,
      authorRole: workspaceMemberships.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(eq(comments.id, commentId))
    .limit(1);

  if (rows.length === 0) {
    throw new ApiError(404, "Comment not found");
  }

  return (await attachCommentRelations(rows as CommentRow[]))[0];
}

export async function storeCommentMentions(
  commentId: string,
  mentions: string[] | undefined,
  authorId: string,
  boardId: string
): Promise<string[]> {
  if (!mentions || mentions.length === 0) {
    return [];
  }

  const uniqueMentions = Array.from(new Set(mentions)).filter((mentionId) => mentionId !== authorId);
  const existingUsers = await db
    .select({ id: users.id })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(and(eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId()), inArray(users.id, uniqueMentions)));

  if (uniqueMentions.length === 0) {
    return [];
  }

  if (existingUsers.length === 0) {
    return [];
  }

  const allowedUsers: string[] = [];
  for (const user of existingUsers) {
    if (await userHasPermission(user.id, "view_boards", { scopeType: "board", scopeId: boardId })) {
      allowedUsers.push(user.id);
    }
  }

  if (allowedUsers.length === 0) {
    return [];
  }

  await db.insert(commentMentions)
    .values(allowedUsers.map((userId) => ({
      commentId,
      userId,
      createdAt: new Date(),
      seenAt: null
    })))
    .execute();

  return allowedUsers;
}

export async function createCommentRecord(params: {
  boardId: string;
  listId: string | null;
  cardId: string | null;
  input: CreateCommentInput;
  authorId: string;
}): Promise<BoardComment> {
  const now = new Date();
  const commentId = crypto.randomUUID();
  const safeBody = sanitizeRequiredPlainText(params.input.body, { field: "Comment body", min: 1, max: 2000 });

  await db.insert(comments)
    .values({
      id: commentId,
      boardId: params.boardId,
      listId: params.listId,
      cardId: params.cardId,
      authorId: params.authorId,
      body: safeBody,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  const mentionIds = await storeCommentMentions(commentId, params.input.mentions, params.authorId, params.boardId);
  const snippet = clipAuditText(safeBody, 140) ?? "Comment";

  await recordActivity({
    type: "comment.created",
    actorId: params.authorId,
    boardId: params.boardId,
    listId: params.listId,
    cardId: params.cardId,
    metadata: {
      commentId,
      snippet
    }
  });

  for (const mentionedUserId of mentionIds) {
    await recordActivity({
      type: "mention.board",
      actorId: params.authorId,
      boardId: params.boardId,
      listId: params.listId,
      cardId: params.cardId,
      mentionedUserId,
      metadata: {
        commentId,
        snippet
      }
    });
  }

  return getCommentById(commentId);
}

