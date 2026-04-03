import request from "supertest";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let closePool: () => Promise<void>;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;
  closePool = dbModule.closePool;

  await initializeDatabase();
});

describe("GET /api/health", () => {
  it("returns service health payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(typeof response.body.data.timestamp).toBe("string");
  });

  it("sets security and request-id headers", async () => {
    const response = await request(app).get("/api/health");

    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("allows configured origins and omits CORS headers for unknown origins", async () => {
    const allowed = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    const denied = await request(app)
      .get("/api/health")
      .set("Origin", "https://evil.example.com");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

afterAll(async () => {
  await closePool();
});
