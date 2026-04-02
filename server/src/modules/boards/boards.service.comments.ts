import { and, eq } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/connection.js";
import { emitBoardEvent } from "../../realtime/socket.js";
import { commentMentions, commentReactions, comments } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CommentReactionInput, CreateCommentInput } from "./boards.schema.js";
import type { BoardComment } from "./boards.service.types.js";
import { assertBoardExists, assertCardExists, assertCommentExists, assertListExists, getCardBoardContext } from "./boards.service.lookups.js";
import { createCommentRecord, getCommentById } from "./boards.service.comments-data.js";

export async function deleteComment(commentId: string, requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }): Promise<void> {
  const comment = await assertCommentExists(commentId);

  const canDelete = requester.canDeleteAny || (requester.canDeleteOwn && comment.authorId === requester.userId);
  if (!canDelete) {
    throw new ApiError(403, "You can only delete comments you created");
  }

  await db.transaction(async (tx: DbTransaction) => {
    await tx.delete(commentMentions).where(eq(commentMentions.commentId, commentId)).execute();
    await tx.delete(commentReactions).where(eq(commentReactions.commentId, commentId)).execute();
    await tx.delete(comments).where(eq(comments.id, commentId)).execute();
  });

  emitBoardEvent(comment.boardId, { boardId: comment.boardId, type: "comment.deleted", data: { commentId } });
}

export async function createBoardComment(boardId: string, input: CreateCommentInput, authorId: string): Promise<BoardComment> {
  await assertBoardExists(boardId);

  return createCommentRecord({
    boardId,
    listId: null,
    cardId: null,
    input,
    authorId
  });
}

export async function createListComment(listId: string, input: CreateCommentInput, authorId: string): Promise<BoardComment> {
  const list = await assertListExists(listId);

  return createCommentRecord({
    boardId: list.boardId,
    listId: list.id,
    cardId: null,
    input,
    authorId
  });
}

export async function createCardComment(cardId: string, input: CreateCommentInput, authorId: string): Promise<BoardComment> {
  await assertCardExists(cardId);
  const { boardId } = await getCardBoardContext(cardId);

  return createCommentRecord({
    boardId,
    listId: null,
    cardId,
    input,
    authorId
  });
}

export async function toggleCommentReaction(commentId: string, userId: string, input: CommentReactionInput): Promise<BoardComment> {
  await assertCommentExists(commentId);

  const existingRows = await db
    .select({ commentId: commentReactions.commentId })
    .from(commentReactions)
    .where(and(
      eq(commentReactions.commentId, commentId),
      eq(commentReactions.userId, userId),
      eq(commentReactions.emoji, input.emoji)
    ))
    .limit(1);

  if (existingRows[0]) {
    await db.delete(commentReactions)
      .where(and(
        eq(commentReactions.commentId, commentId),
        eq(commentReactions.userId, userId),
        eq(commentReactions.emoji, input.emoji)
      ))
      .execute();
  } else {
    await db.insert(commentReactions)
      .values({
        commentId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .execute();
  }

  const updated = await getCommentById(commentId);
  emitBoardEvent(updated.boardId, { boardId: updated.boardId, type: "comment.reaction", data: { commentId } });
  return updated;
}
