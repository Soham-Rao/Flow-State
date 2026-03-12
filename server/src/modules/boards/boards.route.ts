import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import {
  createBoard,
  createList,
  deleteBoard,
  deleteList,
  getBoardById,
  getBoards,
  reorderLists,
  updateBoard,
  updateList
} from "./boards.service.js";
import {
  createBoardSchema,
  createListSchema,
  reorderListsSchema,
  updateBoardSchema,
  updateListSchema
} from "./boards.schema.js";

export const boardsRouter = Router();

boardsRouter.use(requireAuth);

boardsRouter.get("/", (_req, res) => {
  const data = getBoards();

  res.status(200).json({
    success: true,
    data
  });
});

boardsRouter.post("/", (req, res, next) => {
  try {
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

boardsRouter.get("/:boardId", (req, res, next) => {
  try {
    const data = getBoardById(req.params.boardId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/:boardId", (req, res, next) => {
  try {
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

boardsRouter.delete("/:boardId", (req, res, next) => {
  try {
    deleteBoard(req.params.boardId);

    res.status(200).json({
      success: true,
      data: {
        message: "Board deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/lists", (req, res, next) => {
  try {
    const body = createListSchema.parse(req.body);
    const data = createList(req.params.boardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/:boardId/lists/reorder", (req, res, next) => {
  try {
    const body = reorderListsSchema.parse(req.body);
    const data = reorderLists(req.params.boardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/lists/:listId", (req, res, next) => {
  try {
    const body = updateListSchema.parse(req.body);
    const data = updateList(req.params.listId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/lists/:listId", (req, res, next) => {
  try {
    deleteList(req.params.listId);

    res.status(200).json({
      success: true,
      data: {
        message: "List deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});
