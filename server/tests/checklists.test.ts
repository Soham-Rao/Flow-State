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
      name: "Checklist Board",
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
  process.env.DATABASE_URL = "./data/flowstate.checklists.test.db";
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

describe("Checklists API", () => {
  it("creates checklists and items and returns them in board detail", async () => {
    const auth = await registerAndGetAuth("checklists@example.com", "Checklist User");
    const { boardId, todoListId } = await createBoardWithDefaults(auth.token);

    const cardResponse = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ title: "Checklist card" });

    const cardId = cardResponse.body.data.id as string;

    const checklistResponse = await request(app)
      .post(`/api/boards/cards/${cardId}/checklists`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ title: "Launch prep" });

    expect(checklistResponse.status).toBe(201);

    const checklistId = checklistResponse.body.data.id as string;

    const itemResponse = await request(app)
      .post(`/api/boards/checklists/${checklistId}/items`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ title: "Write docs" });

    expect(itemResponse.status).toBe(201);

    const itemId = itemResponse.body.data.id as string;

    const toggleResponse = await request(app)
      .patch(`/api/boards/checklist-items/${itemId}`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ isDone: true });

    expect(toggleResponse.status).toBe(200);
    expect(toggleResponse.body.data.isDone).toBe(true);

    const boardResponse = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(boardResponse.status).toBe(200);

    const list = boardResponse.body.data.lists.find((entry: { id: string }) => entry.id === todoListId) as {
      cards: Array<{ id: string; checklists: Array<{ id: string; items: Array<{ id: string }> }> }>;
    };

    const card = list.cards.find((entry) => entry.id === cardId);

    expect(card).toBeTruthy();
    expect(card!.checklists).toHaveLength(1);
    expect(card!.checklists[0].id).toBe(checklistId);
    expect(card!.checklists[0].items).toHaveLength(1);
  });
});

afterAll(() => {
  clearDatabaseForTests();
});
