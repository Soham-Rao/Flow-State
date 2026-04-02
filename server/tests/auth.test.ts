import request from "supertest";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");

  app = appModule.app;
  initializeDatabase = dbInitModule.initializeDatabase;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;

  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

describe("Auth API", () => {
  it("registers first user as admin", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123"
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.role).toBe("admin");
    expect(response.body.data.token).toEqual(expect.any(String));
  });

  it("registers second user as guest", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Admin",
      email: "admin@example.com",
      password: "password123"
    });

    const response = await request(app).post("/api/auth/register").send({
      name: "Member",
      email: "member@example.com",
      password: "password123"
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("guest");
  });

  it("logs in and returns a token", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123"
    });

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
      password: "password123"
    });

    const token = registerResponse.body.data.token as string;
    const meResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.email).toBe("soham@example.com");
  });

  it("returns 401 for invalid login", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Soham",
      email: "soham@example.com",
      password: "password123"
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "soham@example.com",
      password: "wrongpass"
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
