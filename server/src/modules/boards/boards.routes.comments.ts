import { Router } from "express";

import { assertPermission, getUserPermissions } from "../../utils/permissions.js";
import { deleteComment, toggleCommentReaction } from "./boards.service.js";
import { commentReactionSchema } from "./boards.schema.js";

export const boardsCommentsRouter = Router();

boardsCommentsRouter.delete("/comments/:commentId", (req, res, next) => {
  try {
    const permissions = getUserPermissions(req.auth!.userId);
    deleteComment(req.params.commentId, {
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

boardsCommentsRouter.post("/comments/:commentId/reactions", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "react");
    const body = commentReactionSchema.parse(req.body);
    const data = toggleCommentReaction(req.params.commentId, req.auth!.userId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
