import crypto from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { cards, type CardCoverColor } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateCardInput, MoveCardInput, UpdateCardInput } from "./boards.schema.js";
import type { BoardCard, MoveCardResult } from "./boards.service.types.js";
import { clampIndex, normalizeCoverColor, normalizeDueDate, normalizeOptionalDescription, resolveRestoredName } from "./boards.service.utils.js";
import { assertCardExists, assertListExists, getListRecord } from "./boards.service.lookups.js";
import { deleteAttachmentsForCard, getCardById, getCardByIdIncludingArchived, getCardsForList } from "./boards.service.cards-data.js";

export function createCard(listId: string, input: CreateCardInput, userId: string): BoardCard {
  const list = assertListExists(listId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
    .from(cards)
    .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
    .get();

  const now = new Date();
  const cardId = crypto.randomUUID();

  db.insert(cards)
    .values({
      id: cardId,
      listId: list.id,
      title: input.title.trim(),
      description: normalizeOptionalDescription(input.description),
      priority: input.priority,
      coverColor: normalizeCoverColor(input.coverColor) ?? null,
      dueDate: normalizeDueDate(input.dueDate) ?? null,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      createdBy: userId,
      doneEnteredAt: list.isDoneList ? now : null,
      createdAt: now,
      updatedAt: now
    })
    .run();

  recordActivity({
    type: "card.created",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    cardId,
    metadata: { cardTitle: input.title.trim(), listName: list.name }
  });

  return getCardById(cardId);
}

export function updateCard(cardId: string, input: UpdateCardInput, userId: string): BoardCard {
  assertCardExists(cardId);

  const updatePayload: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high" | "urgent";
    coverColor?: CardCoverColor | null;
    dueDate?: Date | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.title !== undefined) {
    updatePayload.title = input.title.trim();
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalDescription(input.description);
  }

  if (input.priority !== undefined) {
    updatePayload.priority = input.priority;
  }

  if (input.coverColor !== undefined) {
    updatePayload.coverColor = normalizeCoverColor(input.coverColor) ?? null;
  }

  if (input.dueDate !== undefined) {
    updatePayload.dueDate = normalizeDueDate(input.dueDate) ?? null;
  }

  db.update(cards).set(updatePayload).where(eq(cards.id, cardId)).run();

  const updated = getCardById(cardId);
  const list = getListRecord(updated.listId);
  recordActivity({
    type: "card.updated",
    actorId: userId,
    boardId: list.boardId,
    listId: updated.listId,
    cardId: updated.id,
    metadata: { cardTitle: updated.title }
  });

  return updated;
}

export async function deleteCard(
  cardId: string,
  requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }
): Promise<void> {
  const existing = assertCardExists(cardId);
  const list = getListRecord(existing.listId);

  const canDelete = requester.canDeleteAny || (requester.canDeleteOwn && existing.createdBy === requester.userId);
  if (!canDelete) {
    throw new ApiError(403, "You can only delete cards you created");
  }

  await deleteAttachmentsForCard(cardId);

  const result = db.delete(cards).where(eq(cards.id, cardId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Card not found");
  }

  recordActivity({
    type: "card.deleted",
    actorId: requester.userId,
    boardId: list.boardId,
    listId: existing.listId,
    cardId: null,
    metadata: { cardTitle: existing.title, listName: list.name }
  });
}

export function archiveCard(
  cardId: string,
  requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }
): BoardCard {
  const existing = assertCardExists(cardId);

  const canArchive = requester.canDeleteAny || (requester.canDeleteOwn && existing.createdBy === requester.userId);
  if (!canArchive) {
    throw new ApiError(403, "You can only archive cards you created");
  }

  db.update(cards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(cards.id, cardId))
    .run();

  const list = getListRecord(existing.listId);
  recordActivity({
    type: "card.archived",
    actorId: requester.userId,
    boardId: list.boardId,
    listId: existing.listId,
    cardId,
    metadata: { cardTitle: existing.title, listName: list.name }
  });

  return getCardByIdIncludingArchived(cardId);
}

export function restoreCard(
  cardId: string,
  renameConflicts: boolean,
  requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }
): BoardCard {
  const card = getCardByIdIncludingArchived(cardId);
  if (!card.archivedAt) {
    return card;
  }

  const canRestore = requester.canDeleteAny || (requester.canDeleteOwn && card.createdBy === requester.userId);
  if (!canRestore) {
    throw new ApiError(403, "You can only restore cards you created");
  }

  const list = getListRecord(card.listId);
  if (list.archivedAt) {
    throw new ApiError(400, "List is archived. Restore the list first.");
  }

  const existingCards = getCardsForList(list.id);
  const existingNames = new Set(existingCards.map((item) => item.title));
  let nextTitle = card.title;

  if (existingNames.has(nextTitle)) {
    if (!renameConflicts) {
      throw new ApiError(409, "Card with same name exists creating conflict");
    }
    nextTitle = resolveRestoredName(nextTitle, existingNames);
  }

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
    .from(cards)
    .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
    .get();

  db.update(cards)
    .set({
      archivedAt: null,
      title: nextTitle,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      updatedAt: new Date()
    })
    .where(eq(cards.id, cardId))
    .run();

  recordActivity({
    type: "card.restored",
    actorId: requester.userId,
    boardId: list.boardId,
    listId: list.id,
    cardId,
    metadata: { cardTitle: nextTitle, listName: list.name }
  });

  return getCardById(cardId);
}

export function moveCard(input: MoveCardInput, userId: string): MoveCardResult {
  const sourceList = assertListExists(input.sourceListId);
  const destinationList = assertListExists(input.destinationListId);

  if (sourceList.boardId !== destinationList.boardId) {
    throw new ApiError(400, "Source and destination lists must belong to the same board");
  }

  const movingCard = getCardById(input.cardId);

  if (movingCard.listId !== sourceList.id) {
    throw new ApiError(400, "Card does not belong to the provided source list");
  }

  const now = new Date();
  const sourceCards = getCardsForList(sourceList.id);

  if (!sourceCards.some((card) => card.id === movingCard.id)) {
    throw new ApiError(400, "Card does not belong to the source list");
  }

  if (sourceList.id === destinationList.id) {
    const fromIndex = sourceCards.findIndex((card) => card.id === movingCard.id);
    const toIndex = clampIndex(input.destinationIndex, 0, sourceCards.length - 1);

    const reordered = [...sourceCards];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);

    db.transaction((tx) => {
      reordered.forEach((card, index) => {
        tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
      });
    });

    recordActivity({
      type: "card.moved",
      actorId: userId,
      boardId: sourceList.boardId,
      listId: destinationList.id,
      cardId: movingCard.id,
      metadata: {
        cardTitle: movingCard.title,
        fromListId: sourceList.id,
        fromListName: sourceList.name,
        toListId: destinationList.id,
        toListName: destinationList.name
      }
    });

    const updated = getCardsForList(sourceList.id);

    return {
      sourceListId: sourceList.id,
      destinationListId: destinationList.id,
      sourceCards: updated,
      destinationCards: updated
    };
  }

  const destinationCards = getCardsForList(destinationList.id);
  const destinationIndex = clampIndex(input.destinationIndex, 0, destinationCards.length);

  const nextSourceCards = sourceCards.filter((card) => card.id !== movingCard.id);
  const nextDestinationCards = [...destinationCards];
  nextDestinationCards.splice(destinationIndex, 0, movingCard);

  let nextDoneEnteredAt = movingCard.doneEnteredAt ?? null;
  if (destinationList.isDoneList && !sourceList.isDoneList) {
    nextDoneEnteredAt = now;
  }
  if (!destinationList.isDoneList) {
    nextDoneEnteredAt = null;
  }

  db.transaction((tx) => {
    nextSourceCards.forEach((card, index) => {
      tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
    });

    nextDestinationCards.forEach((card, index) => {
      const updatePayload: {
        position: number;
        updatedAt: Date;
        listId?: string;
        doneEnteredAt?: Date | null;
      } = {
        position: index,
        updatedAt: now
      };

      if (card.id === movingCard.id) {
        updatePayload.listId = destinationList.id;
        updatePayload.doneEnteredAt = nextDoneEnteredAt;
      }

      tx.update(cards).set(updatePayload).where(eq(cards.id, card.id)).run();
    });
  });

  recordActivity({
    type: "card.moved",
    actorId: userId,
    boardId: sourceList.boardId,
    listId: destinationList.id,
    cardId: movingCard.id,
    metadata: {
      cardTitle: movingCard.title,
      fromListId: sourceList.id,
      fromListName: sourceList.name,
      toListId: destinationList.id,
      toListName: destinationList.name
    }
  });

  return {
    sourceListId: sourceList.id,
    destinationListId: destinationList.id,
    sourceCards: getCardsForList(sourceList.id),
    destinationCards: getCardsForList(destinationList.id)
  };
}


