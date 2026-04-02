import { Router } from "express";

import { assertPermission, getUserPermissions } from "../../utils/permissions.js";
import { deleteComment, toggleCommentReaction } from "./boards.service.js";
import { commentReactionSchema } from "./boards.schema.js";

export const boardsCommentsRouter = Router();

boardsCommentsRouter.delete("/comments/:commentId", async (req, res, next) => {
  try {
    const permissions = await getUserPermissions(req.auth!.userId);
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
    await assertPermission(req.auth!.userId, "react");
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
