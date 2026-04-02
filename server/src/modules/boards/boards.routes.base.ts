import { Router } from "express";

import { assertPermission } from "../../utils/permissions.js";
import {
  archiveBoard,
  cleanupExpiredCards,
  createBoard,
  createBoardComment,
  deleteBoard,
  getArchivedLists,
  getBoardById,
  getBoards,
  restoreBoard,
  updateBoard
} from "./boards.service.js";
import {
  createBoardSchema,
  createCommentSchema,
  updateBoardSchema
} from "./boards.schema.js";

export const boardsBaseRouter = Router();

boardsBaseRouter.get("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "view_boards");
    const data = await getBoards();

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "create_boards");
    const body = createBoardSchema.parse(req.body);
    const data = await createBoard(body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.get("/:boardId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "view_boards");
    await cleanupExpiredCards();
    const data = await getBoardById(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.patch("/:boardId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "edit_boards");
    const body = updateBoardSchema.parse(req.body);
    const data = await updateBoard(req.params.boardId, body, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.get("/:boardId/archived-lists", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "view_boards");
    const data = await getArchivedLists(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/archive", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "delete_boards");
    const data = await archiveBoard(req.params.boardId, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/restore", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "delete_boards");
    const data = await restoreBoard(req.params.boardId, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/comments", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "comment");
    const body = createCommentSchema.parse(req.body);
    const data = await createBoardComment(req.params.boardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.delete("/:boardId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "delete_boards");
    const data = await deleteBoard(req.params.boardId, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
