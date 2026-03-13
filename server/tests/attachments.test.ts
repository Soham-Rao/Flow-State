import request from "supertest";

let app: import("express").Express;
let initializeDatabase: () => void;
let clearDatabaseForTests: () => void;

interface AuthContext {
  token: string;
  userId: string;
}

async function registerAndGetAuth(email: string, name = "User"): Promise<AuthContext> {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123"
  });

  return {
    token: response.body.data.token as string,
    userId: response.body.data.user.id as string
  };
}

async function createBoardWithDefaults(token: string): Promise<{
  boardId: string;
  todoListId: string;
}> {
  const response = await request(app)
    .post("/api/boards")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Attachments Board",
      background: "teal-gradient"
    });

  const boardId = response.body.data.id as string;
  const lists = response.body.data.lists as Array<{ id: string; name: string }>;

  const todoListId = lists.find((list) => list.name === "To Do")?.id;

  if (!todoListId) {
    throw new Error("Default lists not found");
  }

  return { boardId, todoListId };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "./data/flowstate.attachments.test.db";
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;

  initializeDatabase();
});

beforeEach(() => {
  clearDatabaseForTests();
});

describe("Attachments API", () => {
  it("uploads, lists, downloads, and deletes attachments", async () => {
    const auth = await registerAndGetAuth("attach@example.com", "Attachment User");
    const { boardId, todoListId } = await createBoardWithDefaults(auth.token);

    const cardResponse = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ title: "Card with files" });

    const cardId = cardResponse.body.data.id as string;

    const uploadResponse = await request(app)
      .post(`/api/boards/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${auth.token}`)
      .attach("files", Buffer.from("hello world"), "hello.txt");

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.data).toHaveLength(1);

    const attachment = uploadResponse.body.data[0] as { id: string; originalName: string };
    expect(attachment.originalName).toBe("hello.txt");

    const boardResponse = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${auth.token}`);

    const todoList = boardResponse.body.data.lists.find((list: { id: string }) => list.id === todoListId) as {
      cards: Array<{ id: string; attachments: Array<{ id: string }> }>;
    };

    const card = todoList.cards.find((entry) => entry.id === cardId);
    expect(card?.attachments).toHaveLength(1);

    const downloadResponse = await request(app)
      .get(`/api/boards/attachments/${attachment.id}/download`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.header["content-disposition"]).toContain("hello.txt");

    const deleteResponse = await request(app)
      .delete(`/api/boards/attachments/${attachment.id}`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(deleteResponse.status).toBe(200);

    const boardResponseAfter = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${auth.token}`);

    const todoListAfter = boardResponseAfter.body.data.lists.find((list: { id: string }) => list.id === todoListId) as {
      cards: Array<{ id: string; attachments: Array<{ id: string }> }>;
    };

    const cardAfter = todoListAfter.cards.find((entry) => entry.id === cardId);
    expect(cardAfter?.attachments ?? []).toHaveLength(0);
  });
});

afterAll(() => {
  clearDatabaseForTests();
});
