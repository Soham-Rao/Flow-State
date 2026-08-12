import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { assertBoardExists } from "../boards/boards.service.lookups.js";
import { assertPermission, userHasPermission } from "../../utils/permissions.js";
import { setPrivateShortCache } from "../../utils/http-cache.js";
import { listActivityLogs } from "./activity.service.js";

export const activityRouter = Router();

activityRouter.use(requireAuth, requireWorkspace);

activityRouter.get("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "view_activity_logs");

    const boardId = typeof req.query.boardId === "string" ? req.query.boardId : undefined;
    if (boardId) {
      await assertBoardExists(boardId);
      const canView = await userHasPermission(req.auth!.userId, "view_boards", { scopeType: "board", scopeId: boardId });
      if (!canView) {
        return res.status(403).json({
          success: false,
          error: { message: "You do not have permission to view this board" }
        });
      }
    }

    const data = await listActivityLogs({ boardId });
    setPrivateShortCache(res, boardId ? 6 : 5, 15);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
