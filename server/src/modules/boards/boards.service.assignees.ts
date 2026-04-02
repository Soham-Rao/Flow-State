import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { cardAssignees } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { emitBoardEvent } from "../../realtime/socket.js";
import type { AssignAssigneeInput } from "./boards.schema.js";
import type { BoardCard } from "./boards.service.types.js";
import { assertCardExists, assertUserExists, getCardBoardContext } from "./boards.service.lookups.js";
import { getCardById } from "./boards.service.cards-data.js";

export async function assignMemberToCard(cardId: string, input: AssignAssigneeInput): Promise<BoardCard> {
  await assertCardExists(cardId);
  await assertUserExists(input.userId);
  const { boardId } = await getCardBoardContext(cardId);

  const existingRows = await db
    .select({ cardId: cardAssignees.cardId })
    .from(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, input.userId)))
    .limit(1);

  if (!existingRows[0]) {
    await db.insert(cardAssignees)
      .values({
        cardId,
        userId: input.userId,
        createdAt: new Date()
      })
      .execute();
  }

  const card = await getCardById(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.assignee.updated", data: { cardId } });
  return card;
}

export async function removeMemberFromCard(cardId: string, userId: string): Promise<BoardCard> {
  await assertCardExists(cardId);
  const { boardId } = await getCardBoardContext(cardId);
  const [result] = await db
    .delete(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, userId)))
    .execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Assignee not found");
  }

  const card = await getCardById(cardId);
  emitBoardEvent(boardId, { boardId, type: "card.assignee.updated", data: { cardId } });
  return card;
}
