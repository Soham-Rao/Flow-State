import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import {
  createBoard,
  createCard,
  createChecklist,
  createChecklistItem,
  createList,
  deleteBoard,
  deleteCard,
  deleteChecklist,
  deleteChecklistItem,
  deleteList,
  getBoardById,
  getBoards,
  moveCard,
  reorderLists,
  updateBoard,
  updateCard,
  updateChecklist,
  updateChecklistItem,
  updateList
} from "./boards.service.js";
import {
  createBoardSchema,
  createCardSchema,
  createChecklistItemSchema,
  createChecklistSchema,
  createListSchema,
  moveCardSchema,
  reorderListsSchema,
  updateBoardSchema,
  updateCardSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
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

boardsRouter.post("/lists/:listId/cards", (req, res, next) => {
  try {
    const body = createCardSchema.parse(req.body);
    const data = createCard(req.params.listId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/cards/:cardId", (req, res, next) => {
  try {
    const body = updateCardSchema.parse(req.body);
    const data = updateCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/move", (req, res, next) => {
  try {
    const body = moveCardSchema.parse(req.body);
    const data = moveCard(body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/cards/:cardId", (req, res, next) => {
  try {
    deleteCard(req.params.cardId, req.auth!.userId, req.auth!.role);

    res.status(200).json({
      success: true,
      data: {
        message: "Card deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/cards/:cardId/checklists", (req, res, next) => {
  try {
    const body = createChecklistSchema.parse(req.body);
    const data = createChecklist(req.params.cardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/checklists/:checklistId", (req, res, next) => {
  try {
    const body = updateChecklistSchema.parse(req.body);
    const data = updateChecklist(req.params.checklistId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/checklists/:checklistId", (req, res, next) => {
  try {
    deleteChecklist(req.params.checklistId);

    res.status(200).json({
      success: true,
      data: {
        message: "Checklist deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.post("/checklists/:checklistId/items", (req, res, next) => {
  try {
    const body = createChecklistItemSchema.parse(req.body);
    const data = createChecklistItem(req.params.checklistId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.patch("/checklist-items/:itemId", (req, res, next) => {
  try {
    const body = updateChecklistItemSchema.parse(req.body);
    const data = updateChecklistItem(req.params.itemId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsRouter.delete("/checklist-items/:itemId", (req, res, next) => {
  try {
    deleteChecklistItem(req.params.itemId);

    res.status(200).json({
      success: true,
      data: {
        message: "Checklist item deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});
