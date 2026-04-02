import request from "supertest";
import type { Pool, RowDataPacket } from "mysql2/promise";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;
let pool: Pool;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.FLOWSTATE_DM_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;
  pool = dbModule.pool;

  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

async function registerUser(name: string, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123"
  });

  return { token: response.body.data.token as string, id: response.body.data.user.id as string };
}

describe("Threads API", () => {
  it("creates encrypted DM messages and replies", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const member = await registerUser("Member", "member@example.com");

    const conversationResponse = await request(app)
      .post(`/api/threads/dms/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(conversationResponse.status).toBe(201);
    const conversationId = conversationResponse.body.data.id as string;

    const messageResponse = await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        body: "Hello there",
        mentions: [member.id]
      });

    expect(messageResponse.status).toBe(201);
    expect(messageResponse.body.data.body).toBe("Hello there");

    const messageId = messageResponse.body.data.id as string;
    const [rows] = await pool.query<Array<RowDataPacket & { body: string | null; body_encrypted: string | null }>>(
      "SELECT body, body_encrypted FROM thread_messages WHERE id = ?",
      [messageId]
    );
    const row = rows[0];

    expect(row.body).toBeNull();
    expect(row.body_encrypted).toBeTruthy();

    const replyResponse = await request(app)
      .post(`/api/threads/messages/${messageId}/replies`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        body: "Replying",
        mentions: [admin.id]
      });

    expect(replyResponse.status).toBe(201);

    const repliesResponse = await request(app)
      .get(`/api/threads/messages/${messageId}/replies`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(repliesResponse.status).toBe(200);
    expect(repliesResponse.body.data.length).toBe(1);
  });

  it("tracks unread mentions across threads and comments", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const member = await registerUser("Member", "member@example.com");

    const conversationResponse = await request(app)
      .post(`/api/threads/dms/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    const conversationId = conversationResponse.body.data.id as string;

    await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        body: "Hey @member",
        mentions: [member.id]
      });

    const boardResponse = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        name: "Team Board"
      });

    const boardId = boardResponse.body.data.id as string;
    const commentResponse = await request(app)
      .post(`/api/boards/${boardId}/comments`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        body: "Heads up @member",
        mentions: [member.id]
      });

    const commentId = commentResponse.body.data.id as string;

    const unreadResponse = await request(app)
      .get("/api/mentions/unread")
      .set("Authorization", `Bearer ${member.token}`);

    expect(unreadResponse.status).toBe(200);
    expect(unreadResponse.body.data.threads).toBe(1);
    expect(unreadResponse.body.data.comments).toBe(1);
    expect(unreadResponse.body.data.total).toBe(2);

    await request(app)
      .post("/api/mentions/threads/seen")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        conversationId
      });

    await request(app)
      .post("/api/mentions/comments/seen")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        commentIds: [commentId]
      });

    const clearedResponse = await request(app)
      .get("/api/mentions/unread")
      .set("Authorization", `Bearer ${member.token}`);

    expect(clearedResponse.status).toBe(200);
    expect(clearedResponse.body.data.total).toBe(0);
  });

  it("edits a DM message within 15 minutes", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const member = await registerUser("Member", "member@example.com");

    const conversationResponse = await request(app)
      .post(`/api/threads/dms/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    const conversationId = conversationResponse.body.data.id as string;

    const messageResponse = await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        body: "Original message",
        mentions: []
      });

    const messageId = messageResponse.body.data.id as string;

    const editResponse = await request(app)
      .patch(`/api/threads/messages/${messageId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        body: "Updated message"
      });

    expect(editResponse.status).toBe(200);
    expect(editResponse.body.data.body).toBe("Updated message");

    const [rows] = await pool.query<Array<RowDataPacket & { body: string | null; body_encrypted: string | null }>>(
      "SELECT body, body_encrypted FROM thread_messages WHERE id = ?",
      [messageId]
    );
    const row = rows[0];

    expect(row.body).toBeNull();
    expect(row.body_encrypted).toBeTruthy();
  });

  it("allows channel overrides for users without global permission", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const guest = await registerUser("Guest", "guest@example.com");

    const [guestRoles] = await pool.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM roles WHERE name = ?", ["Guest"]);
    const guestRole = guestRoles[0];
    if (guestRole) {
      await pool.query(
        "DELETE FROM role_permissions WHERE role_id = ? AND permission IN (?, ?)",
        [guestRole.id, "channel_read", "channel_write"]
      );
    }

    const createResponse = await request(app)
      .post("/api/threads/channels")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        name: "Ops",
        members: [
          {
            userId: guest.id,
            overrides: [
              { permission: "channel_read", access: "allow" },
              { permission: "channel_write", access: "allow" }
            ]
          }
        ]
      });

    expect(createResponse.status).toBe(201);
    const conversationId = createResponse.body.data.id as string;

    const listResponse = await request(app)
      .get("/api/threads/channels")
      .set("Authorization", `Bearer ${guest.token}`);

    expect(listResponse.status).toBe(200);
    const channelIds = (listResponse.body.data as Array<{ id: string }>).map((row) => row.id);
    expect(channelIds).toContain(conversationId);

    const postResponse = await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({
        body: "Hello channel",
        mentions: []
      });

    expect(postResponse.status).toBe(201);

    await request(app)
      .patch(`/api/threads/channels/${conversationId}/members/${guest.id}/overrides`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        overrides: [{ permission: "channel_read", access: "allow" }]
      });

    const blockedResponse = await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({
        body: "Should fail",
        mentions: []
      });

    expect(blockedResponse.status).toBe(403);
  });

  it("requires delete_threads permission for delete-for-all", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const member = await registerUser("Member", "member@example.com");

    const [memberRoles] = await pool.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM roles WHERE name = ?", ["Member"]);
    const memberRole = memberRoles[0];
    if (memberRole) {
      await pool.query(
        "DELETE FROM role_permissions WHERE role_id = ? AND permission = ?",
        [memberRole.id, "delete_threads"]
      );
    }

    const conversationResponse = await request(app)
      .post(`/api/threads/dms/${admin.id}`)
      .set("Authorization", `Bearer ${member.token}`);

    const conversationId = conversationResponse.body.data.id as string;

    const messageResponse = await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        body: "Should not delete for all",
        mentions: []
      });

    const messageId = messageResponse.body.data.id as string;

    const deleteResponse = await request(app)
      .delete(`/api/threads/messages/${messageId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        scope: "all"
      });

    expect(deleteResponse.status).toBe(403);
  });

  it("blocks delete-for-all after the other member has seen the message", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const member = await registerUser("Member", "member@example.com");

    const conversationResponse = await request(app)
      .post(`/api/threads/dms/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    const conversationId = conversationResponse.body.data.id as string;

    const messageResponse = await request(app)
      .post(`/api/threads/conversations/${conversationId}/messages`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        body: "Delete me",
        mentions: []
      });

    const messageId = messageResponse.body.data.id as string;

    await pool.query(
      "UPDATE thread_members SET last_read_at = ? WHERE conversation_id = ? AND user_id = ?",
      [new Date(), conversationId, member.id]
    );

    const deleteResponse = await request(app)
      .delete(`/api/threads/messages/${messageId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        scope: "all"
      });

    expect(deleteResponse.status).toBe(400);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
