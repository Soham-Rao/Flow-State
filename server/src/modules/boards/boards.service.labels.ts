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

export async function createLabel(boardId: string, input: CreateLabelInput): Promise<BoardLabel> {
  await assertBoardExists(boardId);

  const now = new Date();
  const labelId = crypto.randomUUID();

  await db.insert(labels)
    .values({
      id: labelId,
      boardId,
      name: input.name.trim(),
      color: input.color,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  const created = await assertLabelExists(labelId);
  emitBoardEvent(boardId, { boardId, type: "label.created", data: { labelId } });
  return created;
}

export async function updateLabel(labelId: string, input: UpdateLabelInput): Promise<BoardLabel> {
  const existing = await assertLabelExists(labelId);

  const updatePayload: { name?: string; color?: LabelColor; updatedAt: Date } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.color !== undefined) {
    updatePayload.color = input.color;
  }

  await db.update(labels).set(updatePayload).where(eq(labels.id, labelId)).execute();

  const updated = await assertLabelExists(labelId);
  emitBoardEvent(existing.boardId, { boardId: existing.boardId, type: "label.updated", data: { labelId } });
  return updated;
}

export async function deleteLabel(labelId: string): Promise<void> {
  const existing = await assertLabelExists(labelId);
  const [result] = await db.delete(labels).where(eq(labels.id, labelId)).execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Label not found");
  }

  emitBoardEvent(existing.boardId, { boardId: existing.boardId, type: "label.deleted", data: { labelId } });
}

export async function assignLabelToCard(cardId: string, input: AssignLabelInput): Promise<BoardCard> {
  await assertCardExists(cardId);
  const label = await assertLabelExists(input.labelId);
  const { boardId } = await getCardBoardContext(cardId);

  if (label.boardId !== boardId) {
    throw new ApiError(400, "Label does not belong to this board");
  }

  const existingRows = await db
    .select({ cardId: cardLabels.cardId })
    .from(cardLabels)
    .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, input.labelId)))
    .limit(1);

  if (!existingRows[0]) {
    await db.insert(cardLabels)
      .values({
        cardId,
        labelId: input.labelId,
        createdAt: new Date()
      })
      .execute();
  }

  const updated = await getCardById(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.label.updated", data: { cardId } });
  return updated;
}

export async function removeLabelFromCard(cardId: string, labelId: string): Promise<BoardCard> {
  await assertCardExists(cardId);
  const [result] = await db
    .delete(cardLabels)
    .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, labelId)))
    .execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Label assignment not found");
  }

  const updated = await getCardById(cardId);
  const { boardId } = await getCardBoardContext(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.label.updated", data: { cardId } });
  return updated;
}
