import { and, desc, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  activityLogs,
  boards,
  cardAssignees,
  cardPriorities,
  cards,
  lists,
  users
} from "../../db/schema.js";
import { userHasPermission } from "../../utils/permissions.js";
import { listUnreadCommentMentions, listUnreadThreadMentions } from "../mentions/mentions.service.js";
import { listAnnouncements, type AnnouncementDetail } from "../announcements/announcements.service.js";

export interface DashboardCardSummary {
  id: string;
  title: string;
  priority: (typeof cardPriorities)[number];
  dueDate: Date | null;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  createdAt: Date;
}

export interface DashboardActivityHighlight {
  boardId: string;
  boardName: string;
  eventCount: number;
}

export interface DashboardNewJoiner {
  id: string;
  name: string;
  displayName: string | null;
  role: string;
  createdAt: Date;
}

export interface DashboardMetricsSummary {
  cardsCompleted: number;
  cardsArchived: number;
  cardsDeleted: number;
  newCards: number;
  newLists: number;
  newBoards: number;
}

export interface DashboardSummary {
  assignedCards: DashboardCardSummary[];
  createdCards: DashboardCardSummary[];
  boardMentions: Awaited<ReturnType<typeof listUnreadCommentMentions>>;
  threadMentions: Awaited<ReturnType<typeof listUnreadThreadMentions>>;
  announcements: AnnouncementDetail[];
  activityHighlights: DashboardActivityHighlight[];
  newJoiners: DashboardNewJoiner[];
  metrics: {
    weekly: DashboardMetricsSummary;
    monthly: DashboardMetricsSummary;
  };
}

async function getAccessibleBoardIds(userId: string, boardIds: string[]): Promise<string[]> {
  if (boardIds.length === 0) return [];
  const results = await Promise.all(boardIds.map(async (boardId) => (
    await userHasPermission(userId, "view_boards", { scopeType: "board", scopeId: boardId })
  )));
  return boardIds.filter((_, index) => results[index]);
}

function mapCardRows(rows: Array<{
  id: string;
  title: string;
  priority: (typeof cardPriorities)[number];
  dueDate: Date | null;
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
  createdAt: Date;
}>): DashboardCardSummary[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    priority: row.priority,
    dueDate: row.dueDate,
    boardId: row.boardId,
    boardName: row.boardName,
    listId: row.listId,
    listName: row.listName,
    createdAt: row.createdAt
  }));
}

async function listAssignedCards(userId: string, accessibleBoardIds: string[]): Promise<DashboardCardSummary[]> {
  if (accessibleBoardIds.length === 0) return [];
  const rows = await db
    .select({
      id: cards.id,
      title: cards.title,
      priority: cards.priority,
      dueDate: cards.dueDate,
      boardId: boards.id,
      boardName: boards.name,
      listId: lists.id,
      listName: lists.name,
      createdAt: cards.createdAt
    })
    .from(cardAssignees)
    .innerJoin(cards, and(eq(cardAssignees.cardId, cards.id), isNull(cards.archivedAt)))
    .innerJoin(lists, and(eq(cards.listId, lists.id), isNull(lists.archivedAt)))
    .innerJoin(boards, and(eq(lists.boardId, boards.id), isNull(boards.archivedAt)))
    .where(
      and(
        eq(cardAssignees.userId, userId),
        inArray(boards.id, accessibleBoardIds),
        ne(lists.isDoneList, true)
      )
    )
    .orderBy(desc(cards.createdAt));

  return mapCardRows(rows);
}

async function listCreatedCards(userId: string, accessibleBoardIds: string[]): Promise<DashboardCardSummary[]> {
  if (accessibleBoardIds.length === 0) return [];
  const rows = await db
    .select({
      id: cards.id,
      title: cards.title,
      priority: cards.priority,
      dueDate: cards.dueDate,
      boardId: boards.id,
      boardName: boards.name,
      listId: lists.id,
      listName: lists.name,
      createdAt: cards.createdAt
    })
    .from(cards)
    .innerJoin(lists, and(eq(cards.listId, lists.id), isNull(lists.archivedAt)))
    .innerJoin(boards, and(eq(lists.boardId, boards.id), isNull(boards.archivedAt)))
    .where(
      and(
        eq(cards.createdBy, userId),
        isNull(cards.archivedAt),
        inArray(boards.id, accessibleBoardIds),
        ne(lists.isDoneList, true)
      )
    )
    .orderBy(desc(cards.createdAt));

  return mapCardRows(rows);
}

async function getMetricsForRange(accessibleBoardIds: string[], startDate: Date): Promise<DashboardMetricsSummary> {
  if (accessibleBoardIds.length === 0) {
    return {
      cardsCompleted: 0,
      cardsArchived: 0,
      cardsDeleted: 0,
      newCards: 0,
      newLists: 0,
      newBoards: 0
    };
  }

  const cardsCompletedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        inArray(boards.id, accessibleBoardIds),
        gte(cards.doneEnteredAt, startDate)
      )
    );

  const cardsArchivedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        inArray(boards.id, accessibleBoardIds),
        gte(cards.archivedAt, startDate)
      )
    );

  const cardsDeletedRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityLogs)
    .where(
      and(
        inArray(activityLogs.boardId, accessibleBoardIds),
        eq(activityLogs.type, "card.deleted"),
        gte(activityLogs.createdAt, startDate)
      )
    );

  const newCardsRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        inArray(boards.id, accessibleBoardIds),
        gte(cards.createdAt, startDate)
      )
    );

  const newListsRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(lists)
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(
      and(
        inArray(boards.id, accessibleBoardIds),
        gte(lists.createdAt, startDate)
      )
    );

  const newBoardsRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(boards)
    .where(
      and(
        inArray(boards.id, accessibleBoardIds),
        gte(boards.createdAt, startDate)
      )
    );

  return {
    cardsCompleted: cardsCompletedRows[0]?.count ?? 0,
    cardsArchived: cardsArchivedRows[0]?.count ?? 0,
    cardsDeleted: cardsDeletedRows[0]?.count ?? 0,
    newCards: newCardsRows[0]?.count ?? 0,
    newLists: newListsRows[0]?.count ?? 0,
    newBoards: newBoardsRows[0]?.count ?? 0
  };
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const boardsList: Array<{ id: string }> = await db.select({ id: boards.id }).from(boards);
  const accessibleBoardIds = await getAccessibleBoardIds(
    userId,
    boardsList.map((board) => board.id)
  );

  const assignedCards = await listAssignedCards(userId, accessibleBoardIds);
  const createdCards = await listCreatedCards(userId, accessibleBoardIds);

  const now = new Date();
  const weeklyStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthlyStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activityHighlights = accessibleBoardIds.length === 0
    ? []
    : await db
        .select({
          boardId: boards.id,
          boardName: boards.name,
          eventCount: sql<number>`count(*)`
        })
        .from(activityLogs)
        .innerJoin(boards, eq(activityLogs.boardId, boards.id))
        .where(
          and(
            inArray(boards.id, accessibleBoardIds),
            gte(activityLogs.createdAt, weeklyStart)
          )
        )
        .groupBy(boards.id)
        .orderBy(desc(sql`count(*)`))
        .limit(5);

  const newJoiners = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(users)
    .where(gte(users.createdAt, monthlyStart))
    .orderBy(desc(users.createdAt))
    .limit(6);

  return {
    assignedCards,
    createdCards,
    boardMentions: await listUnreadCommentMentions(userId),
    threadMentions: await listUnreadThreadMentions(userId),
    activityHighlights,
    newJoiners,
    announcements: await listAnnouncements(userId),
    metrics: {
      weekly: await getMetricsForRange(accessibleBoardIds, weeklyStart),
      monthly: await getMetricsForRange(accessibleBoardIds, monthlyStart)
    }
  };
}
