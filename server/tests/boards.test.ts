import request from "supertest";

let app: import("express").Express;
let initializeDatabase: () => void;
let clearDatabaseForTests: () => void;

async function registerAndGetToken(email = "owner@example.com"): Promise<string> {
  const response = await request(app).post("/api/auth/register").send({
    name: "Owner",
    email,
    password: "password123"
  });

  return response.body.data.token as string;
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "./data/flowstate.boards.test.db";
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

describe("Boards API", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/boards");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("creates board with default lists", async () => {
    const token = await registerAndGetToken();

    const response = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Engineering",
        background: "teal-gradient"
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe("Engineering");
    expect(response.body.data.lists).toHaveLength(3);
  });

  it("creates and reorders lists", async () => {
    const token = await registerAndGetToken();

    const boardResponse = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Product",
        background: "ocean-glow"
      });

    const boardId = boardResponse.body.data.id as string;

    const createListResponse = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Backlog",
        isDoneList: false
      });

    expect(createListResponse.status).toBe(201);

    const boardDetailsResponse = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    const listIds = boardDetailsResponse.body.data.lists.map((list: { id: string }) => list.id) as string[];
    const reordered = [listIds[listIds.length - 1], ...listIds.slice(0, listIds.length - 1)];

    const reorderResponse = await request(app)
      .post(`/api/boards/${boardId}/lists/reorder`)
      .set("Authorization", `Bearer ${token}`)
      .send({ listIds: reordered });

    expect(reorderResponse.status).toBe(200);
    expect(reorderResponse.body.data[0].id).toBe(reordered[0]);
  });

  it("updates and deletes board", async () => {
    const token = await registerAndGetToken();

    const boardResponse = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Marketing",
        background: "sunset-grid"
      });

    const boardId = boardResponse.body.data.id as string;

    const updateResponse = await request(app)
      .patch(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Growth Marketing",
        description: "Q2 campaigns"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe("Growth Marketing");

    const deleteResponse = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(deleteResponse.status).toBe(200);
  });
});

afterAll(() => {
  clearDatabaseForTests();
});
