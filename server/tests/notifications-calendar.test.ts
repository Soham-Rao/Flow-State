import crypto from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";
import { describe, expect, it } from "vitest";

import type { MailMessage } from "../src/utils/mail.js";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;
let db: typeof import("../src/db/connection.js").db;
let schema: typeof import("../src/db/schema.js");
let runDueEmailReminderJob: typeof import("../src/modules/notifications/notifications.service.js").runDueEmailReminderJob;

async function registerAndGetUser(email = "owner@example.com"): Promise<{ token: string; userId: string }> {
  const response = await request(app).post("/api/auth/register").send({
    name: "Owner",
    email,
    password: "password123",
    acceptedLegalTerms: true
  });

  return {
    token: response.body.data.token as string,
    userId: response.body.data.user.id as string
  };
}

async function createBoardFixture(userId: string): Promise<{ boardId: string; activeListId: string; doneListId: string }> {
  const now = new Date();
  const boardId = crypto.randomUUID();
  const activeListId = crypto.randomUUID();
  const doneListId = crypto.randomUUID();

  await db.insert(schema.boards).values({
    id: boardId,
    name: `Board ${boardId.slice(0, 8)}`,
    description: null,
    background: "teal-gradient",
    retentionMode: "card_and_attachments",
    retentionMinutes: 0,
    archiveRetentionMinutes: 10080,
    archivedAt: null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }).execute();

  await db.insert(schema.lists).values([
    {
      id: activeListId,
      boardId,
      name: "Doing",
      position: 0,
      isDoneList: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    },
    {
      id: doneListId,
      boardId,
      name: "Done",
      position: 1,
      isDoneList: true,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    }
  ]).execute();

  return { boardId, activeListId, doneListId };
}

async function createCard(input: {
  listId: string;
  userId: string;
  title: string;
  dueDate: Date;
}): Promise<string> {
  const now = new Date();
  const cardId = crypto.randomUUID();
  await db.insert(schema.cards).values({
    id: cardId,
    listId: input.listId,
    title: input.title,
    description: null,
    priority: "medium",
    coverColor: "none",
    dueDate: input.dueDate,
    position: 0,
    createdBy: input.userId,
    archivedAt: null,
    doneEnteredAt: null,
    createdAt: now,
    updatedAt: now
  }).execute();
  await db.insert(schema.cardAssignees).values({
    cardId,
    userId: input.userId,
    createdAt: now
  }).execute();
  return cardId;
}

function captureMail(messages: MailMessage[]): (message: MailMessage) => Promise<void> {
  return async (message) => {
    messages.push(message);
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.PUBLIC_APP_URL = "http://localhost:4000";
  process.env.REMINDER_EMAILS_ENABLED = "true";
  process.env.REMINDER_EMAIL_TIMEZONE = "Asia/Kolkata";
  process.env.REMINDER_EMAIL_MORNING_HOUR = "9";
  process.env.REMINDER_EMAIL_AFTERNOON_HOUR = "16";
  process.env.REMINDER_EMAIL_DAILY_CAP = "240";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");
  const schemaModule = await import("../src/db/schema.js");
  const notificationsModule = await import("../src/modules/notifications/notifications.service.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;
  db = dbModule.db;
  schema = schemaModule;
  runDueEmailReminderJob = notificationsModule.runDueEmailReminderJob;

  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

describe("due reminder email digests", () => {
  it("sends morning assignee and manager digests, excludes done cards, and dedupes the window", async () => {
    const { userId } = await registerAndGetUser();
    const { activeListId, doneListId } = await createBoardFixture(userId);
    await createCard({
      listId: activeListId,
      userId,
      title: "Visible due card",
      dueDate: new Date("2026-06-02T06:00:00.000Z")
    });
    await createCard({
      listId: doneListId,
      userId,
      title: "Done due card",
      dueDate: new Date("2026-06-02T06:00:00.000Z")
    });

    const messages: MailMessage[] = [];
    const result = await runDueEmailReminderJob({
      now: new Date("2026-06-02T03:30:00.000Z"),
      send: captureMail(messages)
    });

    expect(result.sent).toBe(2);
    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.text).join("\n")).toContain("Visible due card");
    expect(messages.map((message) => message.text).join("\n")).not.toContain("Done due card");

    const secondRun = await runDueEmailReminderJob({
      now: new Date("2026-06-02T03:35:00.000Z"),
      send: captureMail(messages)
    });

    expect(secondRun.sent).toBe(0);
    expect(secondRun.skipped).toBe(2);
  });

  it("keeps afternoon digests to overdue and same-day cards only", async () => {
    const { userId } = await registerAndGetUser();
    const { activeListId } = await createBoardFixture(userId);
    await createCard({
      listId: activeListId,
      userId,
      title: "Today card",
      dueDate: new Date("2026-06-02T10:00:00.000Z")
    });
    await createCard({
      listId: activeListId,
      userId,
      title: "Tomorrow card",
      dueDate: new Date("2026-06-03T10:00:00.000Z")
    });

    const messages: MailMessage[] = [];
    const result = await runDueEmailReminderJob({
      now: new Date("2026-06-02T10:30:00.000Z"),
      send: captureMail(messages)
    });

    expect(result.sent).toBe(1);
    expect(messages[0].text).toContain("Today card");
    expect(messages[0].text).not.toContain("Tomorrow card");
  });

  it("records skipped deliveries after the daily cap is reached", async () => {
    const { userId } = await registerAndGetUser();
    const { activeListId } = await createBoardFixture(userId);
    await createCard({
      listId: activeListId,
      userId,
      title: "Capped card",
      dueDate: new Date("2026-06-02T06:00:00.000Z")
    });

    const messages: MailMessage[] = [];
    const result = await runDueEmailReminderJob({
      now: new Date("2026-06-02T03:30:00.000Z"),
      send: captureMail(messages),
      dailyCap: 1
    });

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(1);
    expect(messages).toHaveLength(1);
  });
});

describe("calendar due-date feeds", () => {
  it("returns private ICS feeds, excludes done cards, and revokes regenerated URLs", async () => {
    const { token, userId } = await registerAndGetUser();
    const { activeListId, doneListId } = await createBoardFixture(userId);
    await createCard({
      listId: activeListId,
      userId,
      title: "Calendar card",
      dueDate: new Date("2026-06-02T06:00:00.000Z")
    });
    await createCard({
      listId: doneListId,
      userId,
      title: "Calendar done card",
      dueDate: new Date("2026-06-02T06:00:00.000Z")
    });

    const feedsResponse = await request(app)
      .get("/api/calendar/feeds")
      .set("Authorization", `Bearer ${token}`);

    expect(feedsResponse.status).toBe(200);
    expect(feedsResponse.body.data.personal.url).toContain("/api/calendar/ics/");
    expect(feedsResponse.body.data.manager.url).toContain("/api/calendar/ics/");

    const personalPath = new URL(feedsResponse.body.data.personal.url as string).pathname;
    const icsResponse = await request(app).get(personalPath);

    expect(icsResponse.status).toBe(200);
    expect(icsResponse.headers["content-type"]).toContain("text/calendar");
    expect(icsResponse.text).toContain("Calendar card");
    expect(icsResponse.text).not.toContain("Calendar done card");

    const regenerated = await request(app)
      .post("/api/calendar/feeds/personal_due_dates/regenerate")
      .set("Authorization", `Bearer ${token}`);

    expect(regenerated.status).toBe(200);
    expect(regenerated.body.data.url).not.toBe(feedsResponse.body.data.personal.url);
    expect((await request(app).get(personalPath)).status).toBe(404);
  });

  it("denies manager ICS data if the owner loses manager due-date permission", async () => {
    const { token, userId } = await registerAndGetUser();
    const feedsResponse = await request(app)
      .get("/api/calendar/feeds")
      .set("Authorization", `Bearer ${token}`);
    const managerPath = new URL(feedsResponse.body.data.manager.url as string).pathname;

    const roleRows = await db
      .select({ roleId: schema.userRoleAssignments.roleId })
      .from(schema.userRoleAssignments)
      .where(eq(schema.userRoleAssignments.userId, userId));

    await db.delete(schema.rolePermissionsTable)
      .where(and(
        inArray(schema.rolePermissionsTable.roleId, roleRows.map((row) => row.roleId)),
        eq(schema.rolePermissionsTable.permission, "view_all_due_date_reminders")
      ))
      .execute();

    const response = await request(app).get(managerPath);
    expect(response.status).toBe(403);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
