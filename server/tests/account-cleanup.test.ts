import crypto from "node:crypto";

import { eq } from "drizzle-orm";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;
let db: typeof import("../src/db/connection.js").db;
let users: typeof import("../src/db/schema.js").users;
let workspaceMemberships: typeof import("../src/db/schema.js").workspaceMemberships;
let invites: typeof import("../src/db/schema.js").invites;
let runAccountCleanup: typeof import("../src/modules/account-cleanup/account-cleanup.service.js").runAccountCleanup;

const defaultWorkspaceId = "8f3e0d8d-2c1c-4e31-9c97-6b724b586001";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.UNASSIGNED_ACCOUNT_CLEANUP_MODE = "disabled";

  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");
  const schemaModule = await import("../src/db/schema.js");
  const cleanupModule = await import("../src/modules/account-cleanup/account-cleanup.service.js");

  initializeDatabase = dbInitModule.initializeDatabase;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;
  db = dbModule.db;
  users = schemaModule.users;
  workspaceMemberships = schemaModule.workspaceMemberships;
  invites = schemaModule.invites;
  runAccountCleanup = cleanupModule.runAccountCleanup;
  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

async function insertUser(input: { id?: string; email: string; createdAt: Date }): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  await db.insert(users).values({
    id,
    name: "Cleanup Test",
    email: input.email,
    passwordHash: "not-used-in-cleanup-tests",
    role: "guest",
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  }).execute();
  return id;
}

describe("never-assigned account cleanup", () => {
  it("reports without writing and deletes only old users with no membership history", async () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    const old = new Date(now.getTime() - 49 * 60 * 60 * 1000);
    const recent = new Date(now.getTime() - 47 * 60 * 60 * 1000);
    const eligibleId = await insertUser({ email: "eligible@example.com", createdAt: old });
    const recentId = await insertUser({ email: "recent@example.com", createdAt: recent });
    const removedMemberId = await insertUser({ email: "removed@example.com", createdAt: old });

    await db.insert(workspaceMemberships).values({
      workspaceId: defaultWorkspaceId,
      userId: removedMemberId,
      status: "removed",
      role: "guest",
      joinedAt: old,
      createdAt: old,
      updatedAt: old
    }).execute();

    const report = await runAccountCleanup({ mode: "report", now, batchSize: 10, requireRecentBackup: false });
    expect(report.eligible).toBe(1);
    expect(report.deleted).toBe(0);
    expect((await db.select({ id: users.id }).from(users)).map((row) => row.id)).toEqual(
      expect.arrayContaining([eligibleId, recentId, removedMemberId])
    );

    const deletion = await runAccountCleanup({ mode: "delete", now, batchSize: 10, requireRecentBackup: false });
    expect(deletion.deleted).toBe(1);
    expect(await db.select({ id: users.id }).from(users).where(eq(users.id, eligibleId))).toHaveLength(0);
    expect(await db.select({ id: users.id }).from(users).where(eq(users.id, recentId))).toHaveLength(1);
    expect(await db.select({ id: users.id }).from(users).where(eq(users.id, removedMemberId))).toHaveLength(1);
  });

  it("exempts an old account while a matching email invite is pending", async () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    const old = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const ownerId = await insertUser({ email: "owner-for-invite@example.com", createdAt: old });
    await db.insert(workspaceMemberships).values({
      workspaceId: defaultWorkspaceId,
      userId: ownerId,
      status: "active",
      role: "admin",
      joinedAt: old,
      createdAt: old,
      updatedAt: old
    }).execute();
    const invitedId = await insertUser({ email: "Invited@Example.com", createdAt: old });
    await db.insert(invites).values({
      id: crypto.randomUUID(),
      workspaceId: defaultWorkspaceId,
      token: crypto.randomBytes(24).toString("hex"),
      email: "invited@example.com",
      role: "guest",
      createdBy: ownerId,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      createdAt: now,
      updatedAt: now
    }).execute();

    const result = await runAccountCleanup({ mode: "delete", now, batchSize: 10, requireRecentBackup: false });
    expect(result.inviteExempt).toBe(1);
    expect(result.deleted).toBe(0);
    expect(await db.select({ id: users.id }).from(users).where(eq(users.id, invitedId))).toHaveLength(1);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
