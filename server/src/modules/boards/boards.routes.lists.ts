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

boardsListsRouter.post("/:boardId/lists", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_lists");
    const body = createListSchema.parse(req.body);
    const data = await createList(req.params.boardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.post("/:boardId/lists/reorder", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_lists");
    const body = reorderListsSchema.parse(req.body);
    const data = await reorderLists(req.params.boardId, body, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.patch("/lists/:listId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_lists");
    const body = updateListSchema.parse(req.body);
    const data = await updateList(req.params.listId, body, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.delete("/lists/:listId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_lists");
    await deleteList(req.params.listId, req.auth!.userId);

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

boardsListsRouter.post("/lists/:listId/archive", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_lists");
    const data = await archiveList(req.params.listId, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.post("/lists/:listId/restore", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_lists");
    const body = restoreArchiveSchema.parse(req.body);
    const data = await restoreList(req.params.listId, body.renameConflicts ?? false, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsListsRouter.post("/lists/:listId/comments", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "comment");
    const body = createCommentSchema.parse(req.body);
    const data = await createListComment(req.params.listId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
