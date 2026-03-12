import crypto from "node:crypto";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { boards, cards, lists, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  CreateBoardInput,
  CreateCardInput,
  CreateListInput,
  MoveCardInput,
  ReorderListsInput,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateListInput
} from "./boards.schema.js";

interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  background: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  listCount: number;
}

export interface BoardCard {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: Date | null;
  position: number;
  createdBy: string;
  archivedAt: Date | null;
  doneEnteredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isDoneList: boolean;
  createdAt: Date;
  updatedAt: Date;
  cards: BoardCard[];
}

interface BoardDetail {
  id: string;
  name: string;
  description: string | null;
  background: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lists: BoardList[];
}

interface ListRecord {
  id: string;
  boardId: string;
  isDoneList: boolean;
}

interface MoveCardResult {
  sourceListId: string;
  destinationListId: string;
  sourceCards: BoardCard[];
  destinationCards: BoardCard[];
}

const defaultLists = [
  { name: "To Do", isDoneList: false },
  { name: "In Progress", isDoneList: false },
  { name: "Done", isDoneList: true }
] as const;

function normalizeOptionalDescription(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function clampIndex(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function assertBoardExists(boardId: string): void {
  const board = db.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).limit(1).get();

  if (!board) {
    throw new ApiError(404, "Board not found");
  }
}

function assertListExists(listId: string): ListRecord {
  const list = db
    .select({ id: lists.id, boardId: lists.boardId, isDoneList: lists.isDoneList })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!list) {
    throw new ApiError(404, "List not found");
  }

  return list;
}

function assertCardExists(cardId: string): BoardCard {
  const card = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .where(and(eq(cards.id, cardId), isNull(cards.archivedAt)))
    .limit(1)
    .get();

  if (!card) {
    throw new ApiError(404, "Card not found");
  }

  return card as BoardCard;
}

function getCardsForList(listId: string): BoardCard[] {
  return db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as BoardCard[];
}

function getCardById(cardId: string): BoardCard {
  const card = assertCardExists(cardId);
  return card;
}

export function getBoards(): BoardSummary[] {
  const boardRows = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      createdBy: boards.createdBy,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt
    })
    .from(boards)
    .orderBy(asc(boards.name))
    .all();

  const countRows = db
    .select({
      boardId: lists.boardId,
      listCount: count(lists.id)
    })
    .from(lists)
    .groupBy(lists.boardId)
    .all();

  const countsByBoardId = new Map(countRows.map((row) => [row.boardId, row.listCount]));

  return boardRows.map((row) => ({
    ...row,
    listCount: countsByBoardId.get(row.id) ?? 0
  }));
}

export function getBoardById(boardId: string): BoardDetail {
  const board = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      createdBy: boards.createdBy,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt
    })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
    .get();

  if (!board) {
    throw new ApiError(404, "Board not found");
  }

  const boardLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all();

  const boardCards = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as BoardCard[];

  const cardsByListId = new Map<string, BoardCard[]>();
  for (const card of boardCards) {
    const existing = cardsByListId.get(card.listId) ?? [];
    existing.push(card);
    cardsByListId.set(card.listId, existing);
  }

  return {
    ...board,
    lists: boardLists.map((list) => ({
      ...list,
      cards: cardsByListId.get(list.id) ?? []
    }))
  };
}

export function createBoard(input: CreateBoardInput, userId: string): BoardDetail {
  const now = new Date();
  const boardId = crypto.randomUUID();

  db.transaction((tx) => {
    tx.insert(boards)
      .values({
        id: boardId,
        name: input.name.trim(),
        description: normalizeOptionalDescription(input.description),
        background: input.background,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      })
      .run();

    tx.insert(lists)
      .values(
        defaultLists.map((defaultList, index) => ({
          id: crypto.randomUUID(),
          boardId,
          name: defaultList.name,
          position: index,
          isDoneList: defaultList.isDoneList,
          createdAt: now,
          updatedAt: now
        }))
      )
      .run();
  });

  return getBoardById(boardId);
}

export function updateBoard(boardId: string, input: UpdateBoardInput): BoardDetail {
  assertBoardExists(boardId);

  const updatePayload: {
    name?: string;
    description?: string | null;
    background?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalDescription(input.description);
  }

  if (input.background !== undefined) {
    updatePayload.background = input.background;
  }

  db.update(boards).set(updatePayload).where(eq(boards.id, boardId)).run();

  return getBoardById(boardId);
}

export function deleteBoard(boardId: string): void {
  const result = db.delete(boards).where(eq(boards.id, boardId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Board not found");
  }
}

export function createList(boardId: string, input: CreateListInput): BoardList {
  assertBoardExists(boardId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${lists.position}), -1)` })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .get();

  const now = new Date();
  const listId = crypto.randomUUID();

  db.insert(lists)
    .values({
      id: listId,
      boardId,
      name: input.name.trim(),
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      isDoneList: input.isDoneList,
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
    cards: []
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

  const updated = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
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
    cards: getCardsForList(updated.id)
  };
}

export function deleteList(listId: string): void {
  const result = db.delete(lists).where(eq(lists.id, listId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "List not found");
  }
}

export function reorderLists(boardId: string, input: ReorderListsInput): BoardList[] {
  assertBoardExists(boardId);

  const existing = db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.boardId, boardId))
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

  return db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all()
    .map((list) => ({
      ...list,
      cards: getCardsForList(list.id)
    }));
}

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
      dueDate: input.dueDate ?? null,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      createdBy: userId,
      doneEnteredAt: list.isDoneList ? now : null,
      createdAt: now,
      updatedAt: now
    })
    .run();

  return getCardById(cardId);
}

export function updateCard(cardId: string, input: UpdateCardInput): BoardCard {
  assertCardExists(cardId);

  const updatePayload: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high" | "urgent";
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

  if (input.dueDate !== undefined) {
    updatePayload.dueDate = input.dueDate;
  }

  db.update(cards).set(updatePayload).where(eq(cards.id, cardId)).run();

  return getCardById(cardId);
}

export function deleteCard(cardId: string, requesterUserId: string, requesterRole: UserRole): void {
  const existing = assertCardExists(cardId);

  if (requesterRole !== "admin" && existing.createdBy !== requesterUserId) {
    throw new ApiError(403, "You can only delete cards you created");
  }

  const result = db.delete(cards).where(eq(cards.id, cardId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Card not found");
  }
}

export function moveCard(input: MoveCardInput): MoveCardResult {
  const sourceList = assertListExists(input.sourceListId);
  const destinationList = assertListExists(input.destinationListId);

  if (sourceList.boardId !== destinationList.boardId) {
    throw new ApiError(400, "Source and destination lists must belong to the same board");
  }

  const movingCard = assertCardExists(input.cardId);

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

    const updated = getCardsForList(sourceList.id);

    return {
      sourceListId: sourceList.id,
      destinationListId: destinationList.id,
      sourceCards: updated,
      destinationCards: updated
    };
  }

  const sourceWithoutCard = sourceCards.filter((card) => card.id !== movingCard.id);
  const destinationCards = getCardsForList(destinationList.id);
  const destinationNext = [...destinationCards];

  const insertIndex = clampIndex(input.destinationIndex, 0, destinationNext.length);

  let nextDoneEnteredAt = movingCard.doneEnteredAt;
  if (!sourceList.isDoneList && destinationList.isDoneList) {
    nextDoneEnteredAt = now;
  } else if (sourceList.isDoneList && !destinationList.isDoneList) {
    nextDoneEnteredAt = null;
  }

  destinationNext.splice(insertIndex, 0, {
    ...movingCard,
    listId: destinationList.id,
    doneEnteredAt: nextDoneEnteredAt,
    updatedAt: now
  });

  db.transaction((tx) => {
    sourceWithoutCard.forEach((card, index) => {
      tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
    });

    destinationNext.forEach((card, index) => {
      if (card.id === movingCard.id) {
        tx.update(cards)
          .set({
            listId: destinationList.id,
            position: index,
            doneEnteredAt: nextDoneEnteredAt,
            updatedAt: now
          })
          .where(eq(cards.id, card.id))
          .run();
      } else {
        tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
      }
    });
  });

  return {
    sourceListId: sourceList.id,
    destinationListId: destinationList.id,
    sourceCards: getCardsForList(sourceList.id),
    destinationCards: getCardsForList(destinationList.id)
  };
}



