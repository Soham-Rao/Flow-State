import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { commentMentions, commentReactions, comments } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CommentReactionInput, CreateCommentInput } from "./boards.schema.js";
import type { BoardComment } from "./boards.service.types.js";
import { assertBoardExists, assertCardExists, assertCommentExists, assertListExists, getCardBoardContext } from "./boards.service.lookups.js";
import { createCommentRecord, getCommentById } from "./boards.service.comments-data.js";

export function deleteComment(commentId: string, requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }): void {
  const comment = assertCommentExists(commentId);

  const canDelete = requester.canDeleteAny || (requester.canDeleteOwn && comment.authorId === requester.userId);
  if (!canDelete) {
    throw new ApiError(403, "You can only delete comments you created");
  }

  db.transaction((tx) => {
    tx.delete(commentMentions).where(eq(commentMentions.commentId, commentId)).run();
    tx.delete(commentReactions).where(eq(commentReactions.commentId, commentId)).run();
    tx.delete(comments).where(eq(comments.id, commentId)).run();
  });
}

export function createBoardComment(boardId: string, input: CreateCommentInput, authorId: string): BoardComment {
  assertBoardExists(boardId);

  return createCommentRecord({
    boardId,
    listId: null,
    cardId: null,
    input,
    authorId
  });
}

export function createListComment(listId: string, input: CreateCommentInput, authorId: string): BoardComment {
  const list = assertListExists(listId);

  return createCommentRecord({
    boardId: list.boardId,
    listId: list.id,
    cardId: null,
    input,
    authorId
  });
}

export function createCardComment(cardId: string, input: CreateCommentInput, authorId: string): BoardComment {
  assertCardExists(cardId);
  const { boardId } = getCardBoardContext(cardId);

  return createCommentRecord({
    boardId,
    listId: null,
    cardId,
    input,
    authorId
  });
}

export function toggleCommentReaction(commentId: string, userId: string, input: CommentReactionInput): BoardComment {
  assertCommentExists(commentId);

  const existing = db
    .select({ commentId: commentReactions.commentId })
    .from(commentReactions)
    .where(and(
      eq(commentReactions.commentId, commentId),
      eq(commentReactions.userId, userId),
      eq(commentReactions.emoji, input.emoji)
    ))
    .limit(1)
    .get();

  if (existing) {
    db.delete(commentReactions)
      .where(and(
        eq(commentReactions.commentId, commentId),
        eq(commentReactions.userId, userId),
        eq(commentReactions.emoji, input.emoji)
      ))
      .run();
  } else {
    db.insert(commentReactions)
      .values({
        commentId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .run();
  }

  return getCommentById(commentId);
}
