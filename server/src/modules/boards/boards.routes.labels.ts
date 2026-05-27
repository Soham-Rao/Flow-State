import { Router } from "express";

import { assertBoardPermission } from "../../utils/access-control.js";
import {
  assignLabelToCard,
  createLabel,
  deleteLabel,
  removeLabelFromCard,
  updateLabel
} from "./boards.service.js";
import { assignLabelSchema, createLabelSchema, updateLabelSchema } from "./boards.schema.js";
import { assertLabelExists, getCardBoardContext } from "./boards.service.lookups.js";

export const boardsLabelsRouter = Router();

boardsLabelsRouter.post("/:boardId/labels", async (req, res, next) => {
  try {
    await assertBoardPermission(req.auth!.userId, "manage_labels", req.params.boardId);
    const body = createLabelSchema.parse(req.body);
    const data = await createLabel(req.params.boardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.patch("/labels/:labelId", async (req, res, next) => {
  try {
    const label = await assertLabelExists(req.params.labelId);
    await assertBoardPermission(req.auth!.userId, "manage_labels", label.boardId);
    const body = updateLabelSchema.parse(req.body);
    const data = await updateLabel(req.params.labelId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.delete("/labels/:labelId", async (req, res, next) => {
  try {
    const label = await assertLabelExists(req.params.labelId);
    await assertBoardPermission(req.auth!.userId, "manage_labels", label.boardId);
    await deleteLabel(req.params.labelId);

    res.status(200).json({
      success: true,
      data: {
        message: "Label deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.post("/cards/:cardId/labels", async (req, res, next) => {
  try {
    const { boardId } = await getCardBoardContext(req.params.cardId);
    await assertBoardPermission(req.auth!.userId, "manage_labels", boardId);
    const body = assignLabelSchema.parse(req.body);
    const data = await assignLabelToCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.delete("/cards/:cardId/labels/:labelId", async (req, res, next) => {
  try {
    const { boardId } = await getCardBoardContext(req.params.cardId);
    await assertBoardPermission(req.auth!.userId, "manage_labels", boardId);
    const data = await removeLabelFromCard(req.params.cardId, req.params.labelId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
