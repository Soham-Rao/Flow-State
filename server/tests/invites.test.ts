import request from "supertest";

const testDbRelative = "./data/flowstate.invites.test.db";

let app: import("express").Express;
let initializeDatabase: () => void;
let clearDatabaseForTests: () => void;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDbRelative;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";

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

async function registerAdmin(): Promise<string> {
  const response = await request(app).post("/api/auth/register").send({
    name: "Admin",
    email: "admin@example.com",
    password: "password123"
  });

  return response.body.data.token as string;
}

describe("Invites API", () => {
  it("creates and lists invites", async () => {
    const token = await registerAdmin();

    const createResponse = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "invitee@example.com" });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data.inviteUrl).toContain("/register?invite=");

    const listResponse = await request(app)
      .get("/api/invites")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.length).toBe(1);
  });

  it("accepts invite during registration", async () => {
    const token = await registerAdmin();

    const createResponse = await request(app)
      .post("/api/invites")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "join@example.com" });

    const inviteUrl = createResponse.body.data.inviteUrl as string;
    const inviteToken = inviteUrl.split("invite=")[1];

    const registerResponse = await request(app).post("/api/auth/register").send({
      name: "Joiner",
      email: "join@example.com",
      password: "password123",
      inviteToken
    });

    expect(registerResponse.status).toBe(201);

    const listResponse = await request(app)
      .get("/api/invites")
      .set("Authorization", `Bearer ${token}`);

    const updated = listResponse.body.data.find((item: { email: string }) => item.email === "join@example.com");
    expect(updated.status).toBe("accepted");
  });
});

afterAll(() => {
  clearDatabaseForTests();
});
