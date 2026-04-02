import crypto from "node:crypto";

import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { cards, lists } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { CreateListInput, ReorderListsInput, UpdateListInput } from "./boards.schema.js";
import type { BoardDetail, BoardList } from "./boards.service.types.js";
import { resolveRestoredName } from "./boards.service.utils.js";
import { assertBoardExists, assertListExists, assertListNameAvailable, getListRecord } from "./boards.service.lookups.js";
import { getCommentsForLists } from "./boards.service.comments-data.js";
import { getCardsForList, getCardsForListIncludingArchived } from "./boards.service.cards-data.js";
import { getBoardById } from "./boards.service.boards.js";

export async function createList(boardId: string, input: CreateListInput, userId: string): Promise<BoardList> {
  await assertBoardExists(boardId);

  const maxPositionRows = await db
    .select({ maxPosition: sql<number>`coalesce(max(${lists.position}), -1)` })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .limit(1);

  const now = new Date();
  const listId = crypto.randomUUID();
  const trimmedName = input.name.trim();

  await assertListNameAvailable(boardId, trimmedName);

  await db.insert(lists)
    .values({
      id: listId,
      boardId,
      name: trimmedName,
      position: (maxPositionRows[0]?.maxPosition ?? -1) + 1,
      isDoneList: input.isDoneList,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  const createdRows = await db
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
    .limit(1);

  const created = createdRows[0];

  if (!created) {
    throw new ApiError(500, "Failed to create list");
  }

  await recordActivity({
    type: "list.created",
    actorId: userId,
    boardId,
    listId: created.id,
    metadata: { listName: created.name }
  });

  return {
    ...created,
    cards: [],
    comments: []
  };
}

export async function updateList(listId: string, input: UpdateListInput, userId: string): Promise<BoardList> {
  const existing = await assertListExists(listId);

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

  await db.update(lists)
    .set(updatePayload)
    .where(and(eq(lists.id, listId), eq(lists.boardId, existing.boardId)))
    .execute();

  if (input.isDoneList !== undefined && input.isDoneList !== existing.isDoneList) {
    const now = new Date();
    if (input.isDoneList) {
      await db.update(cards)
        .set({ doneEnteredAt: now, updatedAt: now })
        .where(and(eq(cards.listId, listId), isNull(cards.archivedAt), isNull(cards.doneEnteredAt)))
        .execute();
    } else {
      await db.update(cards)
        .set({ doneEnteredAt: null, updatedAt: now })
        .where(and(eq(cards.listId, listId), isNull(cards.archivedAt), isNotNull(cards.doneEnteredAt)))
        .execute();
    }
  }

  const updatedRows = await db
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
    .limit(1);

  const updated = updatedRows[0];

  if (!updated) {
    throw new ApiError(404, "List not found");
  }

  await recordActivity({
    type: "list.updated",
    actorId: userId,
    boardId: updated.boardId,
    listId: updated.id,
    metadata: { listName: updated.name, isDoneList: updated.isDoneList }
  });

  return {
    ...updated,
    cards: await getCardsForList(updated.id),
    comments: (await getCommentsForLists([updated.id])).get(updated.id) ?? []
  };
}

export async function deleteList(listId: string, userId: string): Promise<void> {
  const list = await getListRecord(listId);
  const [result] = await db.delete(lists).where(eq(lists.id, listId)).execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "List not found");
  }

  await recordActivity({
    type: "list.deleted",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    metadata: { listName: list.name }
  });
}

export async function archiveList(listId: string, userId: string): Promise<void> {
  const list = await assertListExists(listId);
  if (list.archivedAt) return;

  await db.update(lists)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(lists.id, listId))
    .execute();

  await recordActivity({
    type: "list.archived",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    metadata: { listName: list.name }
  });
}

export async function restoreList(listId: string, renameConflicts: boolean, userId: string): Promise<BoardDetail> {
  const list = await getListRecord(listId);
  if (!list.archivedAt) {
    const restored = await getBoardById(list.boardId);
    await recordActivity({
      type: "list.restored",
      actorId: userId,
      boardId: list.boardId,
      listId: list.id,
      metadata: { listName: list.name }
    });
    return restored;
  }

  const existingRows: Array<{ id: string; name: string }> = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(and(eq(lists.boardId, list.boardId), eq(lists.name, list.name), isNull(lists.archivedAt)))
    .limit(1);

  const existingList = existingRows[0];

  const now = new Date();

  if (existingList) {
    const archivedCards = await getCardsForListIncludingArchived(list.id);
    const existingCards = await getCardsForList(existingList.id);
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

    const maxPositionRows = await db
      .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
      .from(cards)
      .where(and(eq(cards.listId, existingList.id), isNull(cards.archivedAt)))
      .limit(1);

    let nextPosition = (maxPositionRows[0]?.maxPosition ?? -1) + 1;

    await db.transaction(async (tx: DbTransaction) => {
      for (const card of archivedCards) {
        const nextTitle = renameMap.get(card.id) ?? card.title;
        await tx.update(cards)
          .set({
            listId: existingList.id,
            title: nextTitle,
            archivedAt: null,
            position: nextPosition++,
            updatedAt: now
          })
          .where(eq(cards.id, card.id))
          .execute();
      }

      await tx.delete(lists).where(eq(lists.id, list.id)).execute();
    });

    const restored = await getBoardById(list.boardId);
    await recordActivity({
      type: "list.restored",
      actorId: userId,
      boardId: list.boardId,
      listId: list.id,
      metadata: { listName: list.name }
    });
    return restored;
  }

  await db.transaction(async (tx: DbTransaction) => {
    await tx.update(lists)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(lists.id, list.id))
      .execute();

    await tx.update(cards)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(cards.listId, list.id))
      .execute();
  });

  const restored = await getBoardById(list.boardId);
  await recordActivity({
    type: "list.restored",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    metadata: { listName: list.name }
  });
  return restored;
}

export async function reorderLists(boardId: string, input: ReorderListsInput, userId: string): Promise<BoardList[]> {
  await assertBoardExists(boardId);

  const existing: Array<{ id: string }> = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)));

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

  await db.transaction(async (tx: DbTransaction) => {
    for (const [index, listId] of input.listIds.entries()) {
      await tx.update(lists)
        .set({ position: index, updatedAt: now })
        .where(and(eq(lists.id, listId), eq(lists.boardId, boardId)))
        .execute();
    }
  });

  const updatedLists: Array<Omit<BoardList, "cards" | "comments">> = await db
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
    .orderBy(asc(lists.position), asc(lists.createdAt));

  const commentsByListId = await getCommentsForLists(updatedLists.map((list) => list.id));

  await recordActivity({
    type: "list.reordered",
    actorId: userId,
    boardId,
    metadata: { listIds: input.listIds }
  });

  const results: BoardList[] = [];
  for (const list of updatedLists) {
    results.push({
      ...list,
      cards: await getCardsForList(list.id),
      comments: commentsByListId.get(list.id) ?? []
    });
  }

  return results;
}
