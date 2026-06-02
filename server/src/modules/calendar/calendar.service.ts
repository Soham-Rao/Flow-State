import crypto from "node:crypto";

import { and, asc, eq, isNotNull, isNull, ne } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import {
  boards,
  calendarFeedTokens,
  cardAssignees,
  cards,
  lists,
  users,
  type CalendarFeedType
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { userHasPermission } from "../../utils/permissions.js";
import type { DueReminderItem } from "../notifications/notifications.service.js";

export interface CalendarFeedSummary {
  type: CalendarFeedType;
  url: string;
  createdAt: Date;
}

export interface CalendarFeedsResponse {
  personal: CalendarFeedSummary;
  manager: CalendarFeedSummary | null;
}

interface CalendarFeedRecord {
  id: string;
  userId: string;
  feedType: CalendarFeedType;
  token: string;
  revokedAt: Date | null;
  createdAt: Date;
}

function makeToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function feedUrl(token: string): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/api/calendar/ics/${token}.ics`;
}

function normalizeFeedType(value: string): CalendarFeedType {
  if (value === "personal_due_dates" || value === "manager_due_dates") {
    return value;
  }
  throw new ApiError(400, "Unknown calendar feed type");
}

async function assertCanUseFeed(userId: string, feedType: CalendarFeedType): Promise<void> {
  if (feedType === "manager_due_dates") {
    const allowed = await userHasPermission(userId, "view_all_due_date_reminders");
    if (!allowed) {
      throw new ApiError(403, "You do not have permission to use the manager due-date calendar");
    }
  }
}

async function getActiveFeedToken(userId: string, feedType: CalendarFeedType): Promise<CalendarFeedRecord | null> {
  const rows = await db
    .select({
      id: calendarFeedTokens.id,
      userId: calendarFeedTokens.userId,
      feedType: calendarFeedTokens.feedType,
      token: calendarFeedTokens.token,
      revokedAt: calendarFeedTokens.revokedAt,
      createdAt: calendarFeedTokens.createdAt
    })
    .from(calendarFeedTokens)
    .where(and(
      eq(calendarFeedTokens.userId, userId),
      eq(calendarFeedTokens.feedType, feedType),
      isNull(calendarFeedTokens.revokedAt)
    ))
    .orderBy(asc(calendarFeedTokens.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

async function createFeedToken(userId: string, feedType: CalendarFeedType): Promise<CalendarFeedRecord> {
  const now = new Date();
  const record = {
    id: crypto.randomUUID(),
    userId,
    feedType,
    token: makeToken(),
    revokedAt: null,
    createdAt: now
  };

  await db.insert(calendarFeedTokens).values(record).execute();
  return record;
}

async function getOrCreateFeedToken(userId: string, feedType: CalendarFeedType): Promise<CalendarFeedRecord> {
  await assertCanUseFeed(userId, feedType);
  return (await getActiveFeedToken(userId, feedType)) ?? createFeedToken(userId, feedType);
}

function toSummary(record: CalendarFeedRecord): CalendarFeedSummary {
  return {
    type: record.feedType,
    url: feedUrl(record.token),
    createdAt: record.createdAt
  };
}

export async function getCalendarFeeds(userId: string): Promise<CalendarFeedsResponse> {
  const personal = await getOrCreateFeedToken(userId, "personal_due_dates");
  const hasManagerFeed = await userHasPermission(userId, "view_all_due_date_reminders");
  const manager = hasManagerFeed ? await getOrCreateFeedToken(userId, "manager_due_dates") : null;

  return {
    personal: toSummary(personal),
    manager: manager ? toSummary(manager) : null
  };
}

export async function regenerateCalendarFeed(userId: string, rawType: string): Promise<CalendarFeedSummary> {
  const feedType = normalizeFeedType(rawType);
  await assertCanUseFeed(userId, feedType);
  const now = new Date();

  await db.update(calendarFeedTokens)
    .set({ revokedAt: now })
    .where(and(
      eq(calendarFeedTokens.userId, userId),
      eq(calendarFeedTokens.feedType, feedType),
      isNull(calendarFeedTokens.revokedAt)
    ))
    .execute();

  return toSummary(await createFeedToken(userId, feedType));
}

async function getTokenRecord(token: string): Promise<CalendarFeedRecord> {
  const rows = await db
    .select({
      id: calendarFeedTokens.id,
      userId: calendarFeedTokens.userId,
      feedType: calendarFeedTokens.feedType,
      token: calendarFeedTokens.token,
      revokedAt: calendarFeedTokens.revokedAt,
      createdAt: calendarFeedTokens.createdAt
    })
    .from(calendarFeedTokens)
    .where(eq(calendarFeedTokens.token, token))
    .limit(1);

  const record = rows[0];
  if (!record || record.revokedAt) {
    throw new ApiError(404, "Calendar feed not found");
  }

  await assertCanUseFeed(record.userId, record.feedType);
  return record;
}

async function listCalendarDueItems(): Promise<DueReminderItem[]> {
  const rows = await db
    .select({
      cardId: cards.id,
      title: cards.title,
      dueDate: cards.dueDate,
      priority: cards.priority,
      assigneeId: users.id,
      assigneeName: users.name,
      assigneeEmail: users.email,
      boardId: boards.id,
      boardName: boards.name,
      listName: lists.name
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .innerJoin(cardAssignees, eq(cards.id, cardAssignees.cardId))
    .innerJoin(users, eq(cardAssignees.userId, users.id))
    .where(and(
      isNotNull(cards.dueDate),
      isNull(cards.archivedAt),
      isNull(lists.archivedAt),
      isNull(boards.archivedAt),
      ne(lists.isDoneList, true)
    ))
    .orderBy(asc(cards.dueDate), asc(boards.name), asc(lists.position), asc(cards.position));

  return rows.flatMap((row) => row.dueDate ? [{ ...row, dueDate: row.dueDate }] : []);
}

async function filterFeedItems(record: CalendarFeedRecord): Promise<DueReminderItem[]> {
  const allItems = await listCalendarDueItems();
  const ownedItems = record.feedType === "personal_due_dates"
    ? allItems.filter((item) => item.assigneeId === record.userId)
    : allItems;

  const allowedByBoard = new Map<string, boolean>();
  const filtered: DueReminderItem[] = [];

  for (const item of ownedItems) {
    let allowed = allowedByBoard.get(item.boardId);
    if (allowed === undefined) {
      allowed = await userHasPermission(record.userId, "view_boards", { scopeType: "board", scopeId: item.boardId });
      allowedByBoard.set(item.boardId, allowed);
    }
    if (allowed) {
      filtered.push(item);
    }
  }

  return filtered;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line: string): string {
  if (line.length <= 74) {
    return line;
  }

  const chunks: string[] = [];
  let current = line;
  while (current.length > 74) {
    chunks.push(current.slice(0, 74));
    current = current.slice(74);
  }
  chunks.push(current);
  return chunks.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`)).join("\r\n");
}

function cardUrl(item: DueReminderItem): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/boards/${item.boardId}?card=${item.cardId}`;
}

function eventLines(item: DueReminderItem, feedType: CalendarFeedType, generatedAt: Date): string[] {
  const end = new Date(item.dueDate.getTime() + 30 * 60 * 1000);
  const description = [
    `Board: ${item.boardName}`,
    `List: ${item.listName}`,
    `Priority: ${item.priority}`,
    `Assignee: ${item.assigneeName}`,
    `Link: ${cardUrl(item)}`
  ].join("\n");

  return [
    "BEGIN:VEVENT",
    `UID:flowstate-${feedType}-${item.cardId}-${item.assigneeId}@flo-state.in`,
    `DTSTAMP:${formatIcsDate(generatedAt)}`,
    `DTSTART:${formatIcsDate(item.dueDate)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcs(item.title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(`${item.boardName} / ${item.listName}`)}`,
    `URL:${cardUrl(item)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT"
  ];
}

export async function buildCalendarFeed(token: string): Promise<string> {
  const record = await getTokenRecord(token);
  const items = await filterFeedItems(record);
  const generatedAt = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FlowState//Due Dates//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${record.feedType === "manager_due_dates" ? "FlowState Team Due Dates" : "FlowState Due Dates"}`,
    ...items.flatMap((item) => eventLines(item, record.feedType, generatedAt)),
    "END:VCALENDAR"
  ];

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
