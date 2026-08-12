import crypto from "node:crypto";

import { and, asc, count, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import {
  boards,
  cardAssignees,
  cards,
  emailNotificationDeliveries,
  lists,
  userNotificationPreferences,
  users,
  workspaces,
  workspaceMemberships,
  type EmailNotificationKind,
  type EmailNotificationWindow
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { isMailConfigured, sendMail, type MailMessage } from "../../utils/mail.js";
import { userHasPermission } from "../../utils/permissions.js";
import { logger } from "../../utils/logger.js";
import { getCurrentWorkspaceId, getOptionalWorkspaceId, runWithWorkspaceContext } from "../../utils/workspace-context.js";

export interface NotificationPreferences {
  dueEmailEnabled: boolean;
}

export interface DueReminderItem {
  cardId: string;
  title: string;
  dueDate: Date;
  priority: string;
  assigneeId: string;
  assigneeName: string;
  assigneeEmail: string;
  boardId: string;
  boardName: string;
  listName: string;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export interface RunDueEmailReminderOptions {
  now?: Date;
  send?: (message: MailMessage) => Promise<void>;
  dailyCap?: number;
}

interface DigestTarget {
  userId: string;
  email: string;
  name: string;
  kind: EmailNotificationKind;
  window: EmailNotificationWindow;
  digestDate: string;
  items: DueReminderItem[];
  managerDigest: boolean;
}

const REMINDER_LOOKBACK_DAYS = 7;
const REMINDER_JOB_NAME = "notifications.due_email_reminders";

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes): number => {
    const match = parts.find((part) => part.type === type)?.value;
    return Number(match ?? 0);
  };

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

function zonedDateTimeToUtc(parts: Omit<ZonedParts, "second"> & { second?: number }, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0,
    0
  ));
  const zoned = getZonedParts(utcGuess, timeZone);
  const zonedAsUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second,
    0
  );
  const offsetMs = zonedAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

function addLocalDays(parts: Pick<ZonedParts, "year" | "month" | "day">, days: number): Pick<ZonedParts, "year" | "month" | "day"> {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  };
}

function getLocalDayBounds(now: Date, timeZone: string, offsetDays = 0): { start: Date; end: Date; key: string } {
  const local = getZonedParts(now, timeZone);
  const target = addLocalDays(local, offsetDays);
  const start = zonedDateTimeToUtc({ ...target, hour: 0, minute: 0, second: 0 }, timeZone);
  const nextDay = addLocalDays(target, 1);
  const end = zonedDateTimeToUtc({ ...nextDay, hour: 0, minute: 0, second: 0 }, timeZone);
  const key = [
    String(target.year).padStart(4, "0"),
    String(target.month).padStart(2, "0"),
    String(target.day).padStart(2, "0")
  ].join("-");
  return { start, end, key };
}

export function getCurrentReminderDigestWindow(
  now = new Date(),
  timeZone = env.REMINDER_EMAIL_TIMEZONE
): EmailNotificationWindow | null {
  const local = getZonedParts(now, timeZone);
  if (local.hour === env.REMINDER_EMAIL_MORNING_HOUR) {
    return "morning";
  }
  if (local.hour === env.REMINDER_EMAIL_AFTERNOON_HOUR) {
    return "afternoon";
  }
  return null;
}

function getReminderRange(now: Date, window: EmailNotificationWindow): { start: Date; end: Date; digestDate: string } {
  const today = getLocalDayBounds(now, env.REMINDER_EMAIL_TIMEZONE, 0);
  const tomorrow = getLocalDayBounds(now, env.REMINDER_EMAIL_TIMEZONE, 1);
  const lookback = getLocalDayBounds(now, env.REMINDER_EMAIL_TIMEZONE, -REMINDER_LOOKBACK_DAYS);

  return {
    start: lookback.start,
    end: window === "morning" ? tomorrow.end : today.end,
    digestDate: today.key
  };
}

function formatDueDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: env.REMINDER_EMAIL_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function cardUrl(item: DueReminderItem): string {
  return `${env.PUBLIC_APP_URL.replace(/\/$/, "")}/boards/${item.boardId}?card=${item.cardId}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildDigestMessage(target: DigestTarget): MailMessage {
  const heading = target.managerDigest
    ? `Team due-date digest (${target.items.length})`
    : `Your FlowState due-date digest (${target.items.length})`;
  const subject = target.managerDigest
    ? `FlowState team due-date digest - ${target.digestDate}`
    : `FlowState due-date digest - ${target.digestDate}`;

  const textLines = [
    heading,
    "",
    ...target.items.flatMap((item) => [
      `- ${item.title}`,
      `  Due: ${formatDueDate(item.dueDate)}`,
      `  Board/List: ${item.boardName} / ${item.listName}`,
      `  Priority: ${item.priority}`,
      `  Assignee: ${item.assigneeName}`,
      `  Link: ${cardUrl(item)}`
    ])
  ];

  const htmlItems = target.items.map((item) => `
    <li>
      <strong>${escapeHtml(item.title)}</strong><br>
      Due: ${escapeHtml(formatDueDate(item.dueDate))}<br>
      Board/List: ${escapeHtml(item.boardName)} / ${escapeHtml(item.listName)}<br>
      Priority: ${escapeHtml(item.priority)}<br>
      Assignee: ${escapeHtml(item.assigneeName)}<br>
      <a href="${escapeHtml(cardUrl(item))}">Open card</a>
    </li>
  `).join("");

  return {
    to: target.email,
    subject,
    text: textLines.join("\n"),
    html: `<h2>${escapeHtml(heading)}</h2><ul>${htmlItems}</ul>`
  };
}

async function getPreferenceMap(userIds: string[]): Promise<Map<string, boolean>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      userId: userNotificationPreferences.userId,
      dueEmailEnabled: userNotificationPreferences.dueEmailEnabled
    })
    .from(userNotificationPreferences)
    .where(inArray(userNotificationPreferences.userId, userIds));

  return new Map(rows.map((row) => [row.userId, row.dueEmailEnabled]));
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const rows = await db
    .select({ dueEmailEnabled: userNotificationPreferences.dueEmailEnabled })
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  return {
    dueEmailEnabled: rows[0]?.dueEmailEnabled ?? true
  };
}

export async function updateNotificationPreferences(
  userId: string,
  input: NotificationPreferences
): Promise<NotificationPreferences> {
  const now = new Date();
  const existing = await getNotificationPreferences(userId);

  if (existing.dueEmailEnabled === input.dueEmailEnabled) {
    return existing;
  }

  const rows = await db
    .select({ userId: userNotificationPreferences.userId })
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    await db.insert(userNotificationPreferences)
      .values({
        userId,
        dueEmailEnabled: input.dueEmailEnabled,
        createdAt: now,
        updatedAt: now
      })
      .execute();
  } else {
    await db.update(userNotificationPreferences)
      .set({ dueEmailEnabled: input.dueEmailEnabled, updatedAt: now })
      .where(eq(userNotificationPreferences.userId, userId))
      .execute();
  }

  return getNotificationPreferences(userId);
}

export async function listActiveDueReminderItems(start: Date, end: Date): Promise<DueReminderItem[]> {
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
      eq(boards.workspaceId, getCurrentWorkspaceId()),
      isNull(cards.archivedAt),
      isNull(lists.archivedAt),
      isNull(boards.archivedAt),
      ne(lists.isDoneList, true),
      gte(cards.dueDate, start),
      lt(cards.dueDate, end)
    ))
    .orderBy(asc(cards.dueDate), asc(boards.name), asc(lists.position), asc(cards.position));

  return rows.flatMap((row) => row.dueDate ? [{ ...row, dueDate: row.dueDate }] : []);
}

async function filterItemsForUserBoardAccess(userId: string, items: DueReminderItem[]): Promise<DueReminderItem[]> {
  const allowedByBoard = new Map<string, boolean>();
  const filtered: DueReminderItem[] = [];

  for (const item of items) {
    let allowed = allowedByBoard.get(item.boardId);
    if (allowed === undefined) {
      allowed = await userHasPermission(userId, "view_boards", { scopeType: "board", scopeId: item.boardId });
      allowedByBoard.set(item.boardId, allowed);
    }
    if (allowed) {
      filtered.push(item);
    }
  }

  return filtered;
}

async function hasDelivery(target: DigestTarget): Promise<boolean> {
  const rows = await db
    .select({ id: emailNotificationDeliveries.id })
    .from(emailNotificationDeliveries)
    .where(and(
      eq(emailNotificationDeliveries.workspaceId, getCurrentWorkspaceId()),
      eq(emailNotificationDeliveries.userId, target.userId),
      eq(emailNotificationDeliveries.kind, target.kind),
      eq(emailNotificationDeliveries.digestDate, target.digestDate),
      eq(emailNotificationDeliveries.digestWindow, target.window)
    ))
    .limit(1);

  return rows.length > 0;
}

async function sentCountForDigestDate(digestDate: string): Promise<number> {
  const rows = await db
    .select({ total: count(emailNotificationDeliveries.id) })
    .from(emailNotificationDeliveries)
    .where(and(
      eq(emailNotificationDeliveries.workspaceId, getCurrentWorkspaceId()),
      eq(emailNotificationDeliveries.digestDate, digestDate),
      eq(emailNotificationDeliveries.status, "sent")
    ));

  return Number(rows[0]?.total ?? 0);
}

async function recordDelivery(
  target: DigestTarget,
  status: "sent" | "skipped" | "failed",
  error?: string
): Promise<void> {
  await db.insert(emailNotificationDeliveries)
    .values({
      id: crypto.randomUUID(),
      workspaceId: getCurrentWorkspaceId(),
      userId: target.userId,
      kind: target.kind,
      digestDate: target.digestDate,
      digestWindow: target.window,
      recipientEmail: target.email,
      itemCount: target.items.length,
      status,
      error: error ?? null,
      sentAt: status === "sent" ? new Date() : null,
      createdAt: new Date()
    })
    .execute();
}

async function buildAssigneeTargets(
  items: DueReminderItem[],
  window: EmailNotificationWindow,
  digestDate: string
): Promise<DigestTarget[]> {
  const byAssignee = new Map<string, DueReminderItem[]>();
  for (const item of items) {
    const current = byAssignee.get(item.assigneeId) ?? [];
    current.push(item);
    byAssignee.set(item.assigneeId, current);
  }

  const preferenceMap = await getPreferenceMap(Array.from(byAssignee.keys()));
  const targets: DigestTarget[] = [];

  for (const [userId, userItems] of byAssignee.entries()) {
    if (preferenceMap.get(userId) === false) {
      continue;
    }
    const visibleItems = await filterItemsForUserBoardAccess(userId, userItems);
    if (visibleItems.length === 0) {
      continue;
    }
    targets.push({
      userId,
      email: visibleItems[0].assigneeEmail,
      name: visibleItems[0].assigneeName,
      kind: "assignee_due_digest",
      window,
      digestDate,
      items: visibleItems,
      managerDigest: false
    });
  }

  return targets;
}

async function buildManagerTargets(items: DueReminderItem[], window: EmailNotificationWindow, digestDate: string): Promise<DigestTarget[]> {
  if (window !== "morning" || items.length === 0) {
    return [];
  }

  const userRows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(and(
      eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId()),
      eq(workspaceMemberships.status, "active")
    ));
  const managerRows = [];

  for (const user of userRows) {
    const canViewAll = await userHasPermission(user.id, "view_all_due_date_reminders");
    if (canViewAll) {
      managerRows.push(user);
    }
  }

  const preferenceMap = await getPreferenceMap(managerRows.map((user) => user.id));
  const targets: DigestTarget[] = [];

  for (const manager of managerRows) {
    if (preferenceMap.get(manager.id) === false) {
      continue;
    }
    const visibleItems = await filterItemsForUserBoardAccess(manager.id, items);
    if (visibleItems.length === 0) {
      continue;
    }
    targets.push({
      userId: manager.id,
      email: manager.email,
      name: manager.name,
      kind: "manager_due_digest",
      window,
      digestDate,
      items: visibleItems,
      managerDigest: true
    });
  }

  return targets;
}

export async function runDueEmailReminderJob(options: RunDueEmailReminderOptions = {}): Promise<{
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  if (!getOptionalWorkspaceId()) {
    const activeWorkspaces = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.status, "active"));
    const total = { attempted: 0, sent: 0, skipped: 0, failed: 0 };
    for (const workspace of activeWorkspaces) {
      const result = await runWithWorkspaceContext(
        { workspaceId: workspace.id, userId: "system" },
        () => runDueEmailReminderJob(options)
      );
      total.attempted += result.attempted;
      total.sent += result.sent;
      total.skipped += result.skipped;
      total.failed += result.failed;
    }
    return total;
  }

  if (!env.REMINDER_EMAILS_ENABLED) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }

  if (!isMailConfigured() && !options.send) {
    logger.warn(`${REMINDER_JOB_NAME}.skipped`, { reason: "smtp_not_configured" });
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const now = options.now ?? new Date();
  const window = getCurrentReminderDigestWindow(now);
  if (!window) {
    return { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  }

  const range = getReminderRange(now, window);
  const items = await listActiveDueReminderItems(range.start, range.end);
  const targets = [
    ...(await buildAssigneeTargets(items, window, range.digestDate)),
    ...(await buildManagerTargets(items, window, range.digestDate))
  ];

  const mailSender = options.send ?? sendMail;
  const dailyCap = options.dailyCap ?? env.REMINDER_EMAIL_DAILY_CAP;
  let sentSoFar = await sentCountForDigestDate(range.digestDate);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const target of targets) {
    if (await hasDelivery(target)) {
      skipped += 1;
      continue;
    }

    if (sentSoFar >= dailyCap) {
      await recordDelivery(target, "skipped", "Daily reminder email cap reached");
      skipped += 1;
      continue;
    }

    try {
      await mailSender(buildDigestMessage(target));
      await recordDelivery(target, "sent");
      sentSoFar += 1;
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send reminder email";
      await recordDelivery(target, "failed", message.slice(0, 1000));
      failed += 1;
      logger.error(`${REMINDER_JOB_NAME}.send_failed`, {
        userId: target.userId,
        kind: target.kind,
        digestDate: target.digestDate,
        digestWindow: target.window,
        error
      });
    }
  }

  if (targets.length > 0) {
    logger.info(`${REMINDER_JOB_NAME}.complete`, {
      digestDate: range.digestDate,
      digestWindow: window,
      attempted: targets.length,
      sent,
      skipped,
      failed
    });
  }

  return { attempted: targets.length, sent, skipped, failed };
}

export function assertReminderEmailPreference(value: unknown): asserts value is NotificationPreferences {
  if (!value || typeof value !== "object" || typeof (value as NotificationPreferences).dueEmailEnabled !== "boolean") {
    throw new ApiError(400, "dueEmailEnabled must be a boolean");
  }
}
