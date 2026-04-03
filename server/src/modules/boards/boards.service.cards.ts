import crypto from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { cards, type CardCoverColor } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateCardInput, MoveCardInput, UpdateCardInput } from "./boards.schema.js";
import type { BoardCard, MoveCardResult } from "./boards.service.types.js";
import { clampIndex, normalizeCoverColor, normalizeDueDate, normalizeOptionalDescription, normalizeRequiredName, resolveRestoredName } from "./boards.service.utils.js";
import { assertCardExists, assertListExists, getListRecord } from "./boards.service.lookups.js";
import { deleteAttachmentsForCard, getCardById, getCardByIdIncludingArchived, getCardsForList } from "./boards.service.cards-data.js";

export async function createCard(listId: string, input: CreateCardInput, userId: string): Promise<BoardCard> {
  const list = await assertListExists(listId);

  const maxPositionRows = await db
    .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
    .from(cards)
    .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
    .limit(1);

  const now = new Date();
  const cardId = crypto.randomUUID();

  await db.insert(cards)
    .values({
      id: cardId,
      listId: list.id,
      title: normalizeRequiredName(input.title, "Card title", 1, 160),
      description: normalizeOptionalDescription(input.description),
      priority: input.priority,
      coverColor: normalizeCoverColor(input.coverColor) ?? null,
      dueDate: normalizeDueDate(input.dueDate) ?? null,
      position: (maxPositionRows[0]?.maxPosition ?? -1) + 1,
      createdBy: userId,
      doneEnteredAt: list.isDoneList ? now : null,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  await recordActivity({
    type: "card.created",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    cardId,
    metadata: { cardTitle: normalizeRequiredName(input.title, "Card title", 1, 160), listName: list.name }
  });

  return getCardById(cardId);
}

export async function updateCard(cardId: string, input: UpdateCardInput, userId: string): Promise<BoardCard> {
  await assertCardExists(cardId);

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
    updatePayload.title = normalizeRequiredName(input.title, "Card title", 1, 160);
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

  await db.update(cards).set(updatePayload).where(eq(cards.id, cardId)).execute();

  const updated = await getCardById(cardId);
  const list = await getListRecord(updated.listId);
  await recordActivity({
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
  const existing = await assertCardExists(cardId);
  const list = await getListRecord(existing.listId);

  const canDelete = requester.canDeleteAny || (requester.canDeleteOwn && existing.createdBy === requester.userId);
  if (!canDelete) {
    throw new ApiError(403, "You can only delete cards you created");
  }

  await deleteAttachmentsForCard(cardId);

  const [result] = await db.delete(cards).where(eq(cards.id, cardId)).execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Card not found");
  }

  await recordActivity({
    type: "card.deleted",
    actorId: requester.userId,
    boardId: list.boardId,
    listId: existing.listId,
    cardId: null,
    metadata: { cardTitle: existing.title, listName: list.name }
  });
}

export async function archiveCard(
  cardId: string,
  requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }
): Promise<BoardCard> {
  const existing = await assertCardExists(cardId);

  const canArchive = requester.canDeleteAny || (requester.canDeleteOwn && existing.createdBy === requester.userId);
  if (!canArchive) {
    throw new ApiError(403, "You can only archive cards you created");
  }

  await db.update(cards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(cards.id, cardId))
    .execute();

  const list = await getListRecord(existing.listId);
  await recordActivity({
    type: "card.archived",
    actorId: requester.userId,
    boardId: list.boardId,
    listId: existing.listId,
    cardId,
    metadata: { cardTitle: existing.title, listName: list.name }
  });

  return getCardByIdIncludingArchived(cardId);
}

export async function restoreCard(
  cardId: string,
  renameConflicts: boolean,
  requester: { userId: string; canDeleteAny: boolean; canDeleteOwn: boolean }
): Promise<BoardCard> {
  const card = await getCardByIdIncludingArchived(cardId);
  if (!card.archivedAt) {
    return card;
  }

  const canRestore = requester.canDeleteAny || (requester.canDeleteOwn && card.createdBy === requester.userId);
  if (!canRestore) {
    throw new ApiError(403, "You can only restore cards you created");
  }

  const list = await getListRecord(card.listId);
  if (list.archivedAt) {
    throw new ApiError(400, "List is archived. Restore the list first.");
  }

  const existingCards = await getCardsForList(list.id);
  const existingNames = new Set(existingCards.map((item) => item.title));
  let nextTitle = card.title;

  if (existingNames.has(nextTitle)) {
    if (!renameConflicts) {
      throw new ApiError(409, "Card with same name exists creating conflict");
    }
    nextTitle = resolveRestoredName(nextTitle, existingNames);
  }

  const maxPositionRows = await db
    .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
    .from(cards)
    .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
    .limit(1);

  await db.update(cards)
    .set({
      archivedAt: null,
      title: nextTitle,
      position: (maxPositionRows[0]?.maxPosition ?? -1) + 1,
      updatedAt: new Date()
    })
    .where(eq(cards.id, cardId))
    .execute();

  await recordActivity({
    type: "card.restored",
    actorId: requester.userId,
    boardId: list.boardId,
    listId: list.id,
    cardId,
    metadata: { cardTitle: nextTitle, listName: list.name }
  });

  return getCardById(cardId);
}

export async function moveCard(input: MoveCardInput, userId: string): Promise<MoveCardResult> {
  const sourceList = await assertListExists(input.sourceListId);
  const destinationList = await assertListExists(input.destinationListId);

  if (sourceList.boardId !== destinationList.boardId) {
    throw new ApiError(400, "Source and destination lists must belong to the same board");
  }

  const movingCard = await getCardById(input.cardId);

  if (movingCard.listId !== sourceList.id) {
    throw new ApiError(400, "Card does not belong to the provided source list");
  }

  const now = new Date();
  const sourceCards = await getCardsForList(sourceList.id);

  if (!sourceCards.some((card) => card.id === movingCard.id)) {
    throw new ApiError(400, "Card does not belong to the source list");
  }

  if (sourceList.id === destinationList.id) {
    const fromIndex = sourceCards.findIndex((card) => card.id === movingCard.id);
    const toIndex = clampIndex(input.destinationIndex, 0, sourceCards.length - 1);

    const reordered = [...sourceCards];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);

    await db.transaction(async (tx: DbTransaction) => {
      for (const [index, card] of reordered.entries()) {
        await tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).execute();
      }
    });

    await recordActivity({
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

    const updated = await getCardsForList(sourceList.id);

    return {
      sourceListId: sourceList.id,
      destinationListId: destinationList.id,
      sourceCards: updated,
      destinationCards: updated
    };
  }

  const destinationCards = await getCardsForList(destinationList.id);
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

  await db.transaction(async (tx: DbTransaction) => {
    for (const [index, card] of nextSourceCards.entries()) {
      await tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).execute();
    }

    for (const [index, card] of nextDestinationCards.entries()) {
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

      await tx.update(cards).set(updatePayload).where(eq(cards.id, card.id)).execute();
    }
  });

  await recordActivity({
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
    sourceCards: await getCardsForList(sourceList.id),
    destinationCards: await getCardsForList(destinationList.id)
  };
}
