import request from "supertest";
import { vi } from "vitest";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let closePool: () => Promise<void>;
let pool: { query: (sql: string) => Promise<unknown> };

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
  pool = dbModule.pool;

  await initializeDatabase();
});

describe("GET /api/health", () => {
  it("returns service readiness payload on the compatibility route", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.ready).toBe(true);
    expect(response.body.data.checks.database).toBe("ok");
    expect(typeof response.body.data.timestamp).toBe("string");
  });

  it("returns live and ready health endpoints", async () => {
    const live = await request(app).get("/api/health/live");
    const ready = await request(app).get("/api/health/ready");

    expect(live.status).toBe(200);
    expect(live.body.success).toBe(true);
    expect(live.body.data.ready).toBe(true);
    expect(ready.status).toBe(200);
    expect(ready.body.success).toBe(true);
    expect(ready.body.data.checks.database).toBe("ok");
  });

  it("returns degraded readiness when the database probe fails", async () => {
    const querySpy = vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("db down"));

    const response = await request(app).get("/api/health/ready");

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.data.status).toBe("degraded");
    expect(response.body.data.ready).toBe(false);
    expect(response.body.data.checks.database).toBe("error");

    querySpy.mockRestore();
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
