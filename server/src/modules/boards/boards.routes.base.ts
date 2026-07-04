import { Router } from "express";

import { assertBoardPermission } from "../../utils/access-control.js";
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
  updateBoard,
  getBoardMembers,
  getBoardMembersWithOverrides,
  addBoardMembers,
  updateBoardMemberOverrides,
  removeBoardMember
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
    const data = await getBoards(req.auth!.userId);

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

boardsBaseRouter.get("/users", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "view_boards");
    const data = await getBoardMembers();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.get("/:boardId", async (req, res, next) => {
  try {
    await assertBoardPermission(req.auth!.userId, "view_boards", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "edit_boards", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "view_boards", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "delete_boards", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "delete_boards", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "comment", req.params.boardId);
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
    await assertBoardPermission(req.auth!.userId, "delete_boards", req.params.boardId);
    const data = await deleteBoard(req.params.boardId, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});


boardsBaseRouter.get("/:boardId/members", async (req, res, next) => {
  try {
    await assertBoardPermission(req.auth!.userId, "view_boards", req.params.boardId);
    const data = await getBoardMembersWithOverrides(req.params.boardId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.post("/:boardId/members", async (req, res, next) => {
  try {
    const data = await addBoardMembers(req.auth!.userId, req.params.boardId, req.body.userIds);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.patch("/:boardId/members/:memberId/overrides", async (req, res, next) => {
  try {
    const data = await updateBoardMemberOverrides(
      req.auth!.userId,
      req.params.boardId,
      req.params.memberId,
      req.body.overrides
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

boardsBaseRouter.delete("/:boardId/members/:memberId", async (req, res, next) => {
  try {
    const data = await removeBoardMember(req.auth!.userId, req.params.boardId, req.params.memberId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
