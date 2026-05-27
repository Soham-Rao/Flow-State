import { Router } from "express";

import { assertBoardPermission } from "../../utils/access-control.js";
import {
  createChecklist,
  createChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  updateChecklist,
  updateChecklistItem
} from "./boards.service.js";
import {
  createChecklistItemSchema,
  createChecklistSchema,
  updateChecklistItemSchema,
  updateChecklistSchema
} from "./boards.schema.js";
import { getCardBoardContext, getChecklistBoardContext, getChecklistItemBoardContext } from "./boards.service.lookups.js";

export const boardsChecklistsRouter = Router();

boardsChecklistsRouter.post("/cards/:cardId/checklists", async (req, res, next) => {
  try {
    const { boardId } = await getCardBoardContext(req.params.cardId);
    await assertBoardPermission(req.auth!.userId, "manage_checklists", boardId);
    const body = createChecklistSchema.parse(req.body);
    const data = await createChecklist(req.params.cardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsChecklistsRouter.patch("/checklists/:checklistId", async (req, res, next) => {
  try {
    const { boardId } = await getChecklistBoardContext(req.params.checklistId);
    await assertBoardPermission(req.auth!.userId, "manage_checklists", boardId);
    const body = updateChecklistSchema.parse(req.body);
    const data = await updateChecklist(req.params.checklistId, body, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsChecklistsRouter.delete("/checklists/:checklistId", async (req, res, next) => {
  try {
    const { boardId } = await getChecklistBoardContext(req.params.checklistId);
    await assertBoardPermission(req.auth!.userId, "manage_checklists", boardId);
    await deleteChecklist(req.params.checklistId, req.auth!.userId);

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

boardsChecklistsRouter.post("/checklists/:checklistId/items", async (req, res, next) => {
  try {
    const { boardId } = await getChecklistBoardContext(req.params.checklistId);
    await assertBoardPermission(req.auth!.userId, "manage_checklists", boardId);
    const body = createChecklistItemSchema.parse(req.body);
    const data = await createChecklistItem(req.params.checklistId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsChecklistsRouter.patch("/checklist-items/:itemId", async (req, res, next) => {
  try {
    const { boardId } = await getChecklistItemBoardContext(req.params.itemId);
    await assertBoardPermission(req.auth!.userId, "manage_checklists", boardId);
    const body = updateChecklistItemSchema.parse(req.body);
    const data = await updateChecklistItem(req.params.itemId, body, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsChecklistsRouter.delete("/checklist-items/:itemId", async (req, res, next) => {
  try {
    const { boardId } = await getChecklistItemBoardContext(req.params.itemId);
    await assertBoardPermission(req.auth!.userId, "manage_checklists", boardId);
    await deleteChecklistItem(req.params.itemId, req.auth!.userId);

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
