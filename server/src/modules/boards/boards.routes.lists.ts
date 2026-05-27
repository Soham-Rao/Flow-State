import { Router } from "express";

import { assertBoardPermission } from "../../utils/access-control.js";
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
import { getListRecord } from "./boards.service.lookups.js";

export const boardsListsRouter = Router();

boardsListsRouter.post("/:boardId/lists", async (req, res, next) => {
  try {
    await assertBoardPermission(req.auth!.userId, "manage_lists", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "manage_lists", req.params.boardId);
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
    const list = await getListRecord(req.params.listId);
    await assertBoardPermission(req.auth!.userId, "manage_lists", list.boardId);
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
    const list = await getListRecord(req.params.listId);
    await assertBoardPermission(req.auth!.userId, "manage_lists", list.boardId);
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
    const list = await getListRecord(req.params.listId);
    await assertBoardPermission(req.auth!.userId, "manage_lists", list.boardId);
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
    const list = await getListRecord(req.params.listId);
    await assertBoardPermission(req.auth!.userId, "manage_lists", list.boardId);
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
    const list = await getListRecord(req.params.listId);
    await assertBoardPermission(req.auth!.userId, "comment", list.boardId);
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
