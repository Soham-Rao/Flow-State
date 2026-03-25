import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { cardAssignees } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { emitBoardEvent } from "../../realtime/socket.js";
import type { AssignAssigneeInput } from "./boards.schema.js";
import type { BoardCard } from "./boards.service.types.js";
import { assertCardExists, assertUserExists, getCardBoardContext } from "./boards.service.lookups.js";
import { getCardById } from "./boards.service.cards-data.js";

export function assignMemberToCard(cardId: string, input: AssignAssigneeInput): BoardCard {
  assertCardExists(cardId);
  assertUserExists(input.userId);
  const { boardId } = getCardBoardContext(cardId);

  const existing = db
    .select({ cardId: cardAssignees.cardId })
    .from(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, input.userId)))
    .limit(1)
    .get();

  if (!existing) {
    db.insert(cardAssignees)
      .values({
        cardId,
        userId: input.userId,
        createdAt: new Date()
      })
      .run();
  }

  const card = getCardById(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.assignee.updated", data: { cardId } });
  return card;
}

export function removeMemberFromCard(cardId: string, userId: string): BoardCard {
  assertCardExists(cardId);
  const { boardId } = getCardBoardContext(cardId);
  const result = db
    .delete(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(404, "Assignee not found");
  }

  const card = getCardById(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.assignee.updated", data: { cardId } });
  return card;
}
