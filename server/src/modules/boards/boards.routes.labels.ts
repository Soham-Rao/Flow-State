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

boardsLabelsRouter.post("/:boardId/labels", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_labels");
    const body = createLabelSchema.parse(req.body);
    const data = createLabel(req.params.boardId, body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.patch("/labels/:labelId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_labels");
    const body = updateLabelSchema.parse(req.body);
    const data = updateLabel(req.params.labelId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.delete("/labels/:labelId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_labels");
    deleteLabel(req.params.labelId);

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

boardsLabelsRouter.post("/cards/:cardId/labels", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_labels");
    const body = assignLabelSchema.parse(req.body);
    const data = assignLabelToCard(req.params.cardId, body);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsLabelsRouter.delete("/cards/:cardId/labels/:labelId", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "manage_labels");
    const data = removeLabelFromCard(req.params.cardId, req.params.labelId);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
