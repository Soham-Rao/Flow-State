import request from "supertest";

let app: import("express").Express;
let initializeDatabase: () => void;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "./data/flowstate.health.test.db";
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;

  initializeDatabase();
});

describe("GET /api/health", () => {
  it("returns service health payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(typeof response.body.data.timestamp).toBe("string");
  });
});
