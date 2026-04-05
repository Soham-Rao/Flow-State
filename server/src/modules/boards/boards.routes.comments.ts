import { Router } from "express";

import { assertBoardPermission, getBoardScopedPermissions } from "../../utils/access-control.js";
import { deleteComment, toggleCommentReaction } from "./boards.service.js";
import { assertCommentExists } from "./boards.service.lookups.js";
import { commentReactionSchema } from "./boards.schema.js";

export const boardsCommentsRouter = Router();

boardsCommentsRouter.delete("/comments/:commentId", async (req, res, next) => {
  try {
    const comment = await assertCommentExists(req.params.commentId);
    const permissions = await getBoardScopedPermissions(req.auth!.userId, comment.boardId);
    await deleteComment(req.params.commentId, {
      userId: req.auth!.userId,
      canDeleteAny: permissions.has("delete_comments"),
      canDeleteOwn: permissions.has("comment") || permissions.has("edit_comments")
    });

    res.status(200).json({
      success: true,
      data: {
        message: "Comment deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsCommentsRouter.post("/comments/:commentId/reactions", async (req, res, next) => {
  try {
    const comment = await assertCommentExists(req.params.commentId);
    await assertBoardPermission(req.auth!.userId, "react", comment.boardId);
    const body = commentReactionSchema.parse(req.body);
    const data = await toggleCommentReaction(req.params.commentId, req.auth!.userId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
