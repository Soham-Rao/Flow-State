import crypto from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { emitBoardEvent } from "../../realtime/socket.js";
import { cardLabels, labels, type LabelColor } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { AssignLabelInput, CreateLabelInput, UpdateLabelInput } from "./boards.schema.js";
import type { BoardCard, BoardLabel } from "./boards.service.types.js";
import { assertBoardExists, assertCardExists, assertLabelExists, getCardBoardContext } from "./boards.service.lookups.js";
import { getCardById } from "./boards.service.cards-data.js";

export function createLabel(boardId: string, input: CreateLabelInput): BoardLabel {
  assertBoardExists(boardId);

  const now = new Date();
  const labelId = crypto.randomUUID();

  db.insert(labels)
    .values({
      id: labelId,
      boardId,
      name: input.name.trim(),
      color: input.color,
      createdAt: now,
      updatedAt: now
    })
    .run();

  const created = assertLabelExists(labelId);
  emitBoardEvent(boardId, { boardId, type: "label.created", data: { labelId } });
  return created;
}

export function updateLabel(labelId: string, input: UpdateLabelInput): BoardLabel {
  const existing = assertLabelExists(labelId);

  const updatePayload: { name?: string; color?: LabelColor; updatedAt: Date } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.color !== undefined) {
    updatePayload.color = input.color;
  }

  db.update(labels).set(updatePayload).where(eq(labels.id, labelId)).run();

  const updated = assertLabelExists(labelId);
  emitBoardEvent(existing.boardId, { boardId: existing.boardId, type: "label.updated", data: { labelId } });
  return updated;
}

export function deleteLabel(labelId: string): void {
  const existing = assertLabelExists(labelId);
  const result = db.delete(labels).where(eq(labels.id, labelId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Label not found");
  }

  emitBoardEvent(existing.boardId, { boardId: existing.boardId, type: "label.deleted", data: { labelId } });
}

export function assignLabelToCard(cardId: string, input: AssignLabelInput): BoardCard {
  assertCardExists(cardId);
  const label = assertLabelExists(input.labelId);
  const { boardId } = getCardBoardContext(cardId);

  if (label.boardId !== boardId) {
    throw new ApiError(400, "Label does not belong to this board");
  }

  const existing = db
    .select({ cardId: cardLabels.cardId })
    .from(cardLabels)
    .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, input.labelId)))
    .limit(1)
    .get();

  if (!existing) {
    db.insert(cardLabels)
      .values({
        cardId,
        labelId: input.labelId,
        createdAt: new Date()
      })
      .run();
  }

  const updated = getCardById(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.label.updated", data: { cardId } });
  return updated;
}

export function removeLabelFromCard(cardId: string, labelId: string): BoardCard {
  assertCardExists(cardId);
  const result = db
    .delete(cardLabels)
    .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, labelId)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(404, "Label assignment not found");
  }

  const updated = getCardById(cardId);
  const { boardId } = getCardBoardContext(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.label.updated", data: { cardId } });
  return updated;
}
