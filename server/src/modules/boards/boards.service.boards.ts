import crypto from "node:crypto";

import { and, asc, count, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { boards, cards, lists, type RetentionMode } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  ArchivedListEntry,
  BoardCard,
  BoardDetail,
  BoardSummary,
  CardRecord
} from "./boards.service.types.js";
import { DEFAULT_RETENTION_MODE, defaultLists } from "./boards.service.types.js";
import { clampArchiveRetentionMinutes, clampRetentionMinutes, normalizeOptionalDescription } from "./boards.service.utils.js";
import { assertBoardExists, assertBoardNameAvailable, getBoardRecord } from "./boards.service.lookups.js";
import { getBoardMembers } from "./boards.service.members.js";
import { getLabelsForBoard } from "./boards.service.labels-data.js";
import { getCommentsForBoard, getCommentsForLists } from "./boards.service.comments-data.js";
import { attachChecklistsToCards, getBoardSummaryById, getCardsForListIncludingArchived } from "./boards.service.cards-data.js";
import type { CreateBoardInput, UpdateBoardInput } from "./boards.schema.js";

export function getBoards(): BoardSummary[] {
  const boardRows = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
      archiveRetentionMinutes: boards.archiveRetentionMinutes,
      archivedAt: boards.archivedAt,
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
    .where(isNull(lists.archivedAt))
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
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
      archiveRetentionMinutes: boards.archiveRetentionMinutes,
      archivedAt: boards.archivedAt,
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
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all();

  const boardCardRows = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
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
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as CardRecord[];

  const boardCards = attachChecklistsToCards(boardCardRows);

  const cardsByListId = new Map<string, BoardCard[]>();
  for (const card of boardCards) {
    const existing = cardsByListId.get(card.listId) ?? [];
    existing.push(card);
    cardsByListId.set(card.listId, existing);
  }

  const listCommentsByListId = getCommentsForLists(boardLists.map((list) => list.id));
  const boardComments = getCommentsForBoard(boardId);

  return {
    ...board,
    lists: boardLists.map((list) => ({
      ...list,
      cards: cardsByListId.get(list.id) ?? [],
      comments: listCommentsByListId.get(list.id) ?? []
    })),
    labels: getLabelsForBoard(boardId),
    members: getBoardMembers(),
    comments: boardComments
  };
}

export function getArchivedLists(boardId: string): ArchivedListEntry[] {
  assertBoardExists(boardId);

  const archivedLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      archivedAt: lists.archivedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNotNull(lists.archivedAt)))
    .orderBy(asc(lists.archivedAt), asc(lists.createdAt))
    .all();

  const archivedListEntries: ArchivedListEntry[] = archivedLists.map((list) => ({
    id: list.id,
    sourceListId: list.id,
    name: list.name,
    archivedAt: list.archivedAt,
    kind: "list",
    cards: getCardsForListIncludingArchived(list.id)
  }));

  const archivedCardRows = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
      listName: lists.name
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNotNull(cards.archivedAt)))
    .orderBy(asc(cards.archivedAt), asc(cards.createdAt))
    .all() as Array<CardRecord & { listName: string }>;

  const listNameById = new Map(archivedCardRows.map((row) => [row.listId, row.listName]));
  const archivedCards = attachChecklistsToCards(archivedCardRows.map(({ listName, ...card }) => card));

  const archivedCardsByListId = new Map<string, BoardCard[]>();
  for (const card of archivedCards) {
    const list = archivedCardsByListId.get(card.listId) ?? [];
    list.push(card);
    archivedCardsByListId.set(card.listId, list);
  }

  const archivedCardEntries: ArchivedListEntry[] = Array.from(archivedCardsByListId.entries()).map(([listId, cards]) => {
    const listName = listNameById.get(listId) ?? "Archived";
    const archivedAt = cards.reduce<Date | null>((current, card) => {
      if (!card.archivedAt) return current;
      if (!current) return card.archivedAt;
      return card.archivedAt < current ? card.archivedAt : current;
    }, null);
    return {
      id: `archived-cards:${listId}`,
      sourceListId: listId,
      name: `${listName} - archived`,
      archivedAt,
      kind: "cards",
      cards
    };
  });

  return [...archivedListEntries, ...archivedCardEntries];
}

export function createBoard(input: CreateBoardInput, userId: string): BoardDetail {
  const now = new Date();
  const boardId = crypto.randomUUID();
  const trimmedName = input.name.trim();
  const retentionMinutes = clampRetentionMinutes(input.retentionMinutes);
  const retentionMode = input.retentionMode ?? DEFAULT_RETENTION_MODE;
  const archiveRetentionMinutes = clampArchiveRetentionMinutes(input.archiveRetentionMinutes);

  assertBoardNameAvailable(trimmedName);

  db.transaction((tx) => {
    tx.insert(boards)
      .values({
        id: boardId,
        name: trimmedName,
        description: normalizeOptionalDescription(input.description),
        background: input.background,
        retentionMode,
        retentionMinutes,
        archiveRetentionMinutes,
        archivedAt: null,
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
    retentionMode?: RetentionMode;
    retentionMinutes?: number;
    archiveRetentionMinutes?: number;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    assertBoardNameAvailable(trimmed, boardId);
    updatePayload.name = trimmed;
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalDescription(input.description);
  }

  if (input.background !== undefined) {
    updatePayload.background = input.background;
  }

  if (input.retentionMode !== undefined) {
    updatePayload.retentionMode = input.retentionMode;
  }

  if (input.retentionMinutes !== undefined) {
    updatePayload.retentionMinutes = clampRetentionMinutes(input.retentionMinutes);
  }

  if (input.archiveRetentionMinutes !== undefined) {
    updatePayload.archiveRetentionMinutes = clampArchiveRetentionMinutes(input.archiveRetentionMinutes);
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

export function archiveBoard(boardId: string): BoardSummary {
  const board = getBoardRecord(boardId);
  if (board.archivedAt) {
    return getBoardSummaryById(boardId);
  }

  db.update(boards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .run();

  return getBoardSummaryById(boardId);
}

export function restoreBoard(boardId: string): BoardSummary {
  const board = getBoardRecord(boardId);
  if (!board.archivedAt) {
    return getBoardSummaryById(boardId);
  }

  db.update(boards)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .run();

  return getBoardSummaryById(boardId);
}
