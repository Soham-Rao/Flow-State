import crypto from "node:crypto";

import { desc } from "drizzle-orm";
import request from "supertest";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;
let db: typeof import("../src/db/connection.js").db;
let auditLogs: typeof import("../src/db/schema.js").auditLogs;
let passwordResetTokens: typeof import("../src/db/schema.js").passwordResetTokens;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");
  const schemaModule = await import("../src/db/schema.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;
  db = dbModule.db;
  auditLogs = schemaModule.auditLogs;
  passwordResetTokens = schemaModule.passwordResetTokens;

  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

describe("Auth API", () => {
  it("does not expose a role until a workspace is selected", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBeNull();
    expect(response.body.data.token).toEqual(expect.any(String));

    const workspacesResponse = await request(app)
      .get("/api/workspaces")
      .set("Authorization", `Bearer ${response.body.data.token as string}`);
    expect(workspacesResponse.body.data[0].role).toBe("admin");
  });

  it("requires legal consent during registration", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123"
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(JSON.stringify(response.body.error)).toMatch(/accept/i);
  });

  it("blocks a filled registration honeypot without creating an account", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Automated Visitor",
      email: "bot@example.com",
      password: "password123",
      contactWebsite: "https://spam.example",
      acceptedLegalTerms: true
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Unable to create account");
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "bot@example.com",
      password: "password123"
    });
    expect(loginResponse.status).toBe(401);
  });

  it("sanitizes profile text fields during registration and profile updates", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "<b>Soham</b>",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(registerResponse.status).toBe(201);
    const token = registerResponse.body.data.token as string;
    expect(registerResponse.body.data.user.name).toBe("Soham");

    const updateResponse = await request(app)
      .patch("/api/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        displayName: "<img src=x onerror=alert(1)>Builder",
        bio: "<script>alert(1)</script>rm -rf /"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.displayName).toBe("Builder");
    expect(updateResponse.body.data.bio).toContain("rm -rf /");
    expect(updateResponse.body.data.bio).not.toContain("<script>");
  });

  it("keeps the second test user role on its workspace membership", async () => {
    const firstRegister = await request(app).post("/api/auth/register").send({
      name: "Admin",
      email: "admin@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(firstRegister.status).toBe(201);

    const response = await request(app).post("/api/auth/register").send({
      name: "Member",
      email: "member@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBeNull();
    const memberships = await request(app)
      .get("/api/workspaces")
      .set("Authorization", `Bearer ${response.body.data.token as string}`);
    expect(memberships.body.data[0].role).toBe("guest");
  });

  it("logs in and returns a token", async () => {
    const firstRegister = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(firstRegister.status).toBe(201);

    const response = await request(app).post("/api/auth/login").send({
      email: "soham@example.com",
      password: "password123"
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it("returns current user for valid token", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(registerResponse.status).toBe(201);
    const token = registerResponse.body.data.token as string;

    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.email).toBe("soham@example.com");
  });

  it("returns 401 for invalid login and records an audit log", async () => {
    const firstRegister = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(firstRegister.status).toBe(201);

    const response = await request(app).post("/api/auth/login").send({
      email: "soham@example.com",
      password: "wrongpass"
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);

    const rows = await db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt));

    expect(rows.some((row) => row.action === "auth.login.failure")).toBe(true);
  });

  it("returns a generic forgot-password response for existing and missing users", async () => {
    const firstRegister = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(firstRegister.status).toBe(201);

    const existingResponse = await request(app).post("/api/auth/forgot-password").send({
      email: "soham@example.com"
    });
    const missingResponse = await request(app).post("/api/auth/forgot-password").send({
      email: "missing@example.com"
    });

    expect(existingResponse.status).toBe(200);
    expect(missingResponse.status).toBe(200);
    expect(existingResponse.body.data.message).toBe(missingResponse.body.data.message);
  });

  it("resets the password with a valid reset token", async () => {
    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123",
      acceptedLegalTerms: true
    });

    expect(registerResponse.status).toBe(201);
    const userId = registerResponse.body.data.user.id as string;
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const now = new Date();

    await db.insert(passwordResetTokens)
      .values({
        id: crypto.randomUUID(),
        userId,
        tokenHash,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        consumedAt: null,
        createdAt: now
      })
      .execute();

    const resetResponse = await request(app).post("/api/auth/reset-password").send({
      token: rawToken,
      password: "new-password-123"
    });

    expect(resetResponse.status).toBe(200);

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "soham@example.com",
      password: "new-password-123"
    });

    expect(loginResponse.status).toBe(200);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
