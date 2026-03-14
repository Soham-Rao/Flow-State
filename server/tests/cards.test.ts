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

async function getRoleIdByName(token: string, name: string): Promise<string> {
  const response = await request(app)
    .get("/api/roles")
    .set("Authorization", `Bearer ${token}`);

  const role = (response.body.data as Array<{ id: string; name: string }>).find((entry) => entry.name === name);
  if (!role) {
    throw new Error(`Role ${name} not found`);
  }

  return role.id;
}

async function assignRoles(token: string, userId: string, roleIds: string[]): Promise<void> {
  const response = await request(app)
    .patch(`/api/roles/assignments/users/${userId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ roleIds });

  if (response.status !== 200) {
    throw new Error("Failed to assign roles");
  }
}

async function createBoardWithDefaults(token: string): Promise<{
  boardId: string;
  todoListId: string;
  inProgressListId: string;
  doneListId: string;
}> {
  const response = await request(app)
    .post("/api/boards")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Phase 3 Board",
      background: "teal-gradient"
    });

  const boardId = response.body.data.id as string;
  const lists = response.body.data.lists as Array<{ id: string; name: string }>;

  const todoListId = lists.find((list) => list.name === "To Do")?.id;
  const inProgressListId = lists.find((list) => list.name === "In Progress")?.id;
  const doneListId = lists.find((list) => list.name === "Done")?.id;

  if (!todoListId || !inProgressListId || !doneListId) {
    throw new Error("Default lists not found");
  }

  return { boardId, todoListId, inProgressListId, doneListId };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "./data/flowstate.cards.test.db";
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

describe("Cards API", () => {
  it("requires auth to create cards", async () => {
    const response = await request(app).post("/api/boards/lists/not-a-list/cards").send({
      title: "Task"
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("creates card, updates it, and returns cards in board detail", async () => {
    const auth = await registerAndGetAuth("owner@example.com", "Owner");
    const { boardId, todoListId } = await createBoardWithDefaults(auth.token);

    const createResponse = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        title: "API integration",
        description: "Implement create card endpoint",
        priority: "high"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.title).toBe("API integration");
    expect(createResponse.body.data.priority).toBe("high");

    const cardId = createResponse.body.data.id as string;

    const updateResponse = await request(app)
      .patch(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        title: "API integration done",
        dueDate: "2026-03-20T10:00:00.000Z",
        priority: "urgent"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.title).toBe("API integration done");
    expect(updateResponse.body.data.priority).toBe("urgent");
    expect(updateResponse.body.data.dueDate).toBe("2026-03-20T10:00:00.000Z");

    const boardResponse = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${auth.token}`);

    const todo = boardResponse.body.data.lists.find((list: { id: string }) => list.id === todoListId) as {
      cards: Array<{ id: string; title: string }>;
    };

    expect(todo.cards).toHaveLength(1);
    expect(todo.cards[0].id).toBe(cardId);
    expect(todo.cards[0].title).toBe("API integration done");
  });

  it("moves cards across lists and tracks doneEnteredAt", async () => {
    const auth = await registerAndGetAuth("drag@example.com", "Drag User");
    const { todoListId, doneListId } = await createBoardWithDefaults(auth.token);

    const firstCard = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ title: "Card A" });

    const secondCard = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ title: "Card B" });

    const firstCardId = firstCard.body.data.id as string;
    const secondCardId = secondCard.body.data.id as string;

    const reorderInSameList = await request(app)
      .post("/api/boards/cards/move")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        cardId: secondCardId,
        sourceListId: todoListId,
        destinationListId: todoListId,
        destinationIndex: 0
      });

    expect(reorderInSameList.status).toBe(200);
    expect(reorderInSameList.body.data.sourceCards[0].id).toBe(secondCardId);

    const moveToDone = await request(app)
      .post("/api/boards/cards/move")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        cardId: firstCardId,
        sourceListId: todoListId,
        destinationListId: doneListId,
        destinationIndex: 0
      });

    expect(moveToDone.status).toBe(200);
    expect(moveToDone.body.data.destinationCards[0].id).toBe(firstCardId);
    expect(moveToDone.body.data.destinationCards[0].doneEnteredAt).toEqual(expect.any(String));

    const moveBackToTodo = await request(app)
      .post("/api/boards/cards/move")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        cardId: firstCardId,
        sourceListId: doneListId,
        destinationListId: todoListId,
        destinationIndex: 1
      });

    expect(moveBackToTodo.status).toBe(200);
    const movedBackCard = moveBackToTodo.body.data.destinationCards.find((card: { id: string }) => card.id === firstCardId);
    expect(movedBackCard.doneEnteredAt).toBeNull();
  });

  it("enforces delete permissions for non-admin users", async () => {
    const admin = await registerAndGetAuth("admin@example.com", "Admin User");
    const memberOne = await registerAndGetAuth("member-one@example.com", "Member One");
    const memberTwo = await registerAndGetAuth("member-two@example.com", "Member Two");

    const memberRoleId = await getRoleIdByName(admin.token, "Member");
    await assignRoles(admin.token, memberOne.userId, [memberRoleId]);
    await assignRoles(admin.token, memberTwo.userId, [memberRoleId]);

    const { todoListId } = await createBoardWithDefaults(memberOne.token);

    const createdCard = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${memberOne.token}`)
      .send({ title: "Protected card" });

    const cardId = createdCard.body.data.id as string;

    const forbiddenDelete = await request(app)
      .delete(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${memberTwo.token}`);

    expect(forbiddenDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(adminDelete.status).toBe(200);
  });
});

afterAll(() => {
  clearDatabaseForTests();
});
