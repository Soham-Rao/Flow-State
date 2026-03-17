import crypto from "node:crypto";

import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { cards, lists } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateListInput, ReorderListsInput, UpdateListInput } from "./boards.schema.js";
import type { BoardDetail, BoardList } from "./boards.service.types.js";
import { resolveRestoredName } from "./boards.service.utils.js";
import { assertBoardExists, assertListExists, assertListNameAvailable, getListRecord } from "./boards.service.lookups.js";
import { getCommentsForLists } from "./boards.service.comments-data.js";
import { getCardsForList, getCardsForListIncludingArchived } from "./boards.service.cards-data.js";
import { getBoardById } from "./boards.service.boards.js";

export function createList(boardId: string, input: CreateListInput): BoardList {
  assertBoardExists(boardId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${lists.position}), -1)` })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .get();

  const now = new Date();
  const listId = crypto.randomUUID();
  const trimmedName = input.name.trim();

  assertListNameAvailable(boardId, trimmedName);

  db.insert(lists)
    .values({
      id: listId,
      boardId,
      name: trimmedName,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      isDoneList: input.isDoneList,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .run();

  const created = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!created) {
    throw new ApiError(500, "Failed to create list");
  }

  return {
    ...created,
    cards: [],
    comments: []
  };
}

export function updateList(listId: string, input: UpdateListInput): BoardList {
  const existing = assertListExists(listId);

  const updatePayload: {
    name?: string;
    isDoneList?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.isDoneList !== undefined) {
    updatePayload.isDoneList = input.isDoneList;
  }

  db.update(lists)
    .set(updatePayload)
    .where(and(eq(lists.id, listId), eq(lists.boardId, existing.boardId)))
    .run();

  if (input.isDoneList !== undefined && input.isDoneList !== existing.isDoneList) {
    const now = new Date();
    if (input.isDoneList) {
      db.update(cards)
        .set({ doneEnteredAt: now, updatedAt: now })
        .where(and(eq(cards.listId, listId), isNull(cards.archivedAt), isNull(cards.doneEnteredAt)))
        .run();
    } else {
      db.update(cards)
        .set({ doneEnteredAt: null, updatedAt: now })
        .where(and(eq(cards.listId, listId), isNull(cards.archivedAt), isNotNull(cards.doneEnteredAt)))
        .run();
    }
  }

  const updated = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!updated) {
    throw new ApiError(404, "List not found");
  }

  return {
    ...updated,
    cards: getCardsForList(updated.id),
    comments: getCommentsForLists([updated.id]).get(updated.id) ?? []
  };
}

export function deleteList(listId: string): void {
  const result = db.delete(lists).where(eq(lists.id, listId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "List not found");
  }
}

export function archiveList(listId: string): void {
  const list = assertListExists(listId);
  if (list.archivedAt) return;

  db.update(lists)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(lists.id, listId))
    .run();
}

export function restoreList(listId: string, renameConflicts: boolean): BoardDetail {
  const list = getListRecord(listId);
  if (!list.archivedAt) {
    return getBoardById(list.boardId);
  }

  const existingList = db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(and(eq(lists.boardId, list.boardId), eq(lists.name, list.name), isNull(lists.archivedAt)))
    .limit(1)
    .get();

  const now = new Date();

  if (existingList) {
    const archivedCards = getCardsForListIncludingArchived(list.id);
    const existingCards = getCardsForList(existingList.id);
    const existingNames = new Set(existingCards.map((card) => card.title));

    const renameMap = new Map<string, string>();
    for (const card of archivedCards) {
      if (!existingNames.has(card.title)) {
        continue;
      }
      if (!renameConflicts) {
        throw new ApiError(409, "Card with same name exists creating conflict");
      }
      const nextName = resolveRestoredName(card.title, existingNames);
      renameMap.set(card.id, nextName);
      existingNames.add(nextName);
    }

    const maxPositionRow = db
      .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
      .from(cards)
      .where(and(eq(cards.listId, existingList.id), isNull(cards.archivedAt)))
      .get();

    let nextPosition = (maxPositionRow?.maxPosition ?? -1) + 1;

    db.transaction((tx) => {
      archivedCards.forEach((card) => {
        const nextTitle = renameMap.get(card.id) ?? card.title;
        tx.update(cards)
          .set({
            listId: existingList.id,
            title: nextTitle,
            archivedAt: null,
            position: nextPosition++,
            updatedAt: now
          })
          .where(eq(cards.id, card.id))
          .run();
      });

      tx.delete(lists).where(eq(lists.id, list.id)).run();
    });

    return getBoardById(list.boardId);
  }

  db.transaction((tx) => {
    tx.update(lists)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(lists.id, list.id))
      .run();

    tx.update(cards)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(cards.listId, list.id))
      .run();
  });

  return getBoardById(list.boardId);
}

export function reorderLists(boardId: string, input: ReorderListsInput): BoardList[] {
  assertBoardExists(boardId);

  const existing = db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .all();

  const existingIds = existing.map((row) => row.id);

  if (existingIds.length !== input.listIds.length) {
    throw new ApiError(400, "Reorder payload must include every list in the board");
  }

  const existingSet = new Set(existingIds);
  const invalid = input.listIds.some((id) => !existingSet.has(id));

  if (invalid) {
    throw new ApiError(400, "Reorder payload includes invalid list ids");
  }

  const now = new Date();

  db.transaction((tx) => {
    input.listIds.forEach((listId, index) => {
      tx.update(lists)
        .set({ position: index, updatedAt: now })
        .where(and(eq(lists.id, listId), eq(lists.boardId, boardId)))
        .run();
    });
  });

  const updatedLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all();

  const commentsByListId = getCommentsForLists(updatedLists.map((list) => list.id));

  return updatedLists.map((list) => ({
    ...list,
    cards: getCardsForList(list.id),
    comments: commentsByListId.get(list.id) ?? []
  }));
}
