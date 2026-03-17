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

boardsBaseRouter.get("/", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "view_boards");
    const data = getBoards();

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "create_boards");
    const body = createBoardSchema.parse(req.body);
    const data = createBoard(body, req.auth!.userId);

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
    assertPermission(req.auth!.userId, "view_boards");
    await cleanupExpiredCards();
    const data = getBoardById(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.patch("/:boardId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "edit_boards");
    const body = updateBoardSchema.parse(req.body);
    const data = updateBoard(req.params.boardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.get("/:boardId/archived-lists", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "view_boards");
    const data = getArchivedLists(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/archive", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "delete_boards");
    const data = archiveBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/restore", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "delete_boards");
    const data = restoreBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/comments", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "comment");
    const body = createCommentSchema.parse(req.body);
    const data = createBoardComment(req.params.boardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.delete("/:boardId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "delete_boards");
    const data = deleteBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
