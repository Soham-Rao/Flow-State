import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { cardAssignees } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { AssignAssigneeInput } from "./boards.schema.js";
import type { BoardCard } from "./boards.service.types.js";
import { assertCardExists, assertUserExists } from "./boards.service.lookups.js";
import { getCardById } from "./boards.service.cards-data.js";

export function assignMemberToCard(cardId: string, input: AssignAssigneeInput): BoardCard {
  assertCardExists(cardId);
  assertUserExists(input.userId);

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

  return getCardById(cardId);
}

export function removeMemberFromCard(cardId: string, userId: string): BoardCard {
  assertCardExists(cardId);
  const result = db
    .delete(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(404, "Assignee not found");
  }

  return getCardById(cardId);
}
