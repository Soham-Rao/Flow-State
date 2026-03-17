import { Router } from "express";

import { assertPermission } from "../../utils/permissions.js";
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

export const boardsChecklistsRouter = Router();

boardsChecklistsRouter.post("/cards/:cardId/checklists", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_checklists");
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

boardsChecklistsRouter.patch("/checklists/:checklistId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_checklists");
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

boardsChecklistsRouter.delete("/checklists/:checklistId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_checklists");
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

boardsChecklistsRouter.post("/checklists/:checklistId/items", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_checklists");
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

boardsChecklistsRouter.patch("/checklist-items/:itemId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_checklists");
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

boardsChecklistsRouter.delete("/checklist-items/:itemId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_checklists");
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
