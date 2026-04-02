import { Router } from "express";

import { assertPermission } from "../../utils/permissions.js";
import {
  assignLabelToCard,
  createLabel,
  deleteLabel,
  removeLabelFromCard,
  updateLabel
} from "./boards.service.js";
import { assignLabelSchema, createLabelSchema, updateLabelSchema } from "./boards.schema.js";

export const boardsLabelsRouter = Router();

boardsLabelsRouter.post("/:boardId/labels", async (req, res, next) => {
  try {
    await assertPermission(req.auth!.userId, "manage_labels");
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
    await assertPermission(req.auth!.userId, "manage_labels");
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
    await assertPermission(req.auth!.userId, "manage_labels");
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
    await assertPermission(req.auth!.userId, "manage_labels");
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
    await assertPermission(req.auth!.userId, "manage_labels");
    const data = await removeLabelFromCard(req.params.cardId, req.params.labelId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
