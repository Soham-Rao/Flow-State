import { Router } from "express";

import { assertPermission, getUserPermissions } from "../../utils/permissions.js";
import {
  archiveCard,
  assignMemberToCard,
  createCard,
  createCardComment,
  deleteCard,
  moveCard,
  removeMemberFromCard,
  restoreCard,
  updateCard
} from "./boards.service.js";
import {
  assignAssigneeSchema,
  createCardSchema,
  createCommentSchema,
  moveCardSchema,
  restoreArchiveSchema,
  updateCardSchema
} from "./boards.schema.js";

export const boardsCardsRouter = Router();

boardsCardsRouter.post("/lists/:listId/cards", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "create_cards");
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

boardsCardsRouter.patch("/cards/:cardId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "edit_cards");
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

boardsCardsRouter.post("/cards/:cardId/archive", (req, res, next) => {
  try {
    const permissions = getUserPermissions(req.auth!.userId);
    const data = archiveCard(req.params.cardId, {
      userId: req.auth!.userId,
      canDeleteAny: permissions.has("delete_cards_any"),
      canDeleteOwn: permissions.has("delete_cards_own")
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/:cardId/restore", (req, res, next) => {
  try {
    const body = restoreArchiveSchema.parse(req.body);
    const permissions = getUserPermissions(req.auth!.userId);
    const data = restoreCard(
      req.params.cardId,
      body.renameConflicts ?? false,
      {
        userId: req.auth!.userId,
        canDeleteAny: permissions.has("delete_cards_any"),
        canDeleteOwn: permissions.has("delete_cards_own")
      }
    );

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/:cardId/comments", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "comment");
    const body = createCommentSchema.parse(req.body);
    const data = createCardComment(req.params.cardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/:cardId/assignees", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "assign_members");
    const body = assignAssigneeSchema.parse(req.body);
    const data = assignMemberToCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.delete("/cards/:cardId/assignees/:userId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "assign_members");
    const data = removeMemberFromCard(req.params.cardId, req.params.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/move", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "edit_cards");
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

boardsCardsRouter.delete("/cards/:cardId", async (req, res, next) => {
  try {
    const permissions = getUserPermissions(req.auth!.userId);
    await deleteCard(req.params.cardId, {
      userId: req.auth!.userId,
      canDeleteAny: permissions.has("delete_cards_any"),
      canDeleteOwn: permissions.has("delete_cards_own")
    });

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
