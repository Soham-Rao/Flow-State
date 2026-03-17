import { Router } from "express";

import { assertPermission } from "../../utils/permissions.js";
import {
  archiveList,
  createList,
  createListComment,
  deleteList,
  reorderLists,
  restoreList,
  updateList
} from "./boards.service.js";
import {
  createCommentSchema,
  createListSchema,
  reorderListsSchema,
  restoreArchiveSchema,
  updateListSchema
} from "./boards.schema.js";

export const boardsListsRouter = Router();

boardsListsRouter.post("/:boardId/lists", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_lists");
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

boardsListsRouter.post("/:boardId/lists/reorder", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_lists");
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

boardsListsRouter.patch("/lists/:listId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_lists");
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

boardsListsRouter.delete("/lists/:listId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_lists");
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

boardsListsRouter.post("/lists/:listId/archive", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_lists");
    const data = archiveList(req.params.listId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.post("/lists/:listId/restore", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_lists");
    const body = restoreArchiveSchema.parse(req.body);
    const data = restoreList(req.params.listId, body.renameConflicts ?? false);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.post("/lists/:listId/comments", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "comment");
    const body = createCommentSchema.parse(req.body);
    const data = createListComment(req.params.listId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
