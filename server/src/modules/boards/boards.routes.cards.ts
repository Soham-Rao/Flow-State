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

boardsCardsRouter.post("/lists/:listId/cards", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "create_cards");
    const body = createCardSchema.parse(req.body);
    const data = await createCard(req.params.listId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.patch("/cards/:cardId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "edit_cards");
    const body = updateCardSchema.parse(req.body);
    const data = await updateCard(req.params.cardId, body, req.auth!.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/:cardId/archive", async (req, res, next) => {
  try {
    const permissions = await getUserPermissions(req.auth!.userId);
    const data = await archiveCard(req.params.cardId, {
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

boardsCardsRouter.post("/cards/:cardId/restore", async (req, res, next) => {
  try {
    const body = restoreArchiveSchema.parse(req.body);
    const permissions = await getUserPermissions(req.auth!.userId);
    const data = await restoreCard(
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

boardsCardsRouter.post("/cards/:cardId/comments", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "comment");
    const body = createCommentSchema.parse(req.body);
    const data = await createCardComment(req.params.cardId, body, req.auth!.userId);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/:cardId/assignees", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "assign_members");
    const body = assignAssigneeSchema.parse(req.body);
    const data = await assignMemberToCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.delete("/cards/:cardId/assignees/:userId", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "assign_members");
    const data = await removeMemberFromCard(req.params.cardId, req.params.userId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsCardsRouter.post("/cards/move", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "edit_cards");
    const body = moveCardSchema.parse(req.body);
    const data = await moveCard(body, req.auth!.userId);

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
    const permissions = await getUserPermissions(req.auth!.userId);
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
