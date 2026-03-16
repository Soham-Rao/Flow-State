import request from "supertest";

const testDbRelative = "./data/flowstate.threads.test.db";

let app: import("express").Express;
let initializeDatabase: () => void;
let clearDatabaseForTests: () => void;
let sqlite: typeof import("../src/db/connection.js").sqlite;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDbRelative;
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
  sqlite = dbModule.sqlite;

  initializeDatabase();
});

beforeEach(() => {
  clearDatabaseForTests();
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
    const row = sqlite.prepare("SELECT body, body_encrypted FROM thread_messages WHERE id = ?").get(messageId) as {
      body: string | null;
      body_encrypted: string | null;
    };

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
});

afterAll(() => {
  clearDatabaseForTests();
});
