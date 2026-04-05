import request from "supertest";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;

async function registerUser(name: string, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123",
    acceptedLegalTerms: true
  });

  if (response.status !== 201) {
    throw new Error(`Registration failed: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return {
    token: response.body.data.token as string,
    id: response.body.data.user.id as string
  };
}

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
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;

  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

describe("Bug reports API", () => {
  it("lets authenticated users create reports and list their own items", async () => {
    await registerUser("Admin", "admin@example.com");
    const reporter = await registerUser("Reporter", "reporter@example.com");

    const createResponse = await request(app)
      .post("/api/bug-reports")
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({
        title: "Dashboard load issue",
        message: "The dashboard spinner stays visible after the page reconnects.",
        pagePath: "/"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.status).toBe("open");
    expect(createResponse.body.data.reporter.id).toBe(reporter.id);

    const mineResponse = await request(app)
      .get("/api/bug-reports/mine")
      .set("Authorization", `Bearer ${reporter.token}`);

    expect(mineResponse.status).toBe(200);
    expect(mineResponse.body.data).toHaveLength(1);
    expect(mineResponse.body.data[0].title).toBe("Dashboard load issue");

    const summaryResponse = await request(app)
      .get("/api/bug-reports/summary")
      .set("Authorization", `Bearer ${reporter.token}`);

    expect(summaryResponse.status).toBe(200);
    expect(summaryResponse.body.data.myOpenCount).toBe(1);
    expect(summaryResponse.body.data.canManageAll).toBe(false);
    expect(summaryResponse.body.data.openCount).toBeNull();
  });

  it("blocks non-admin access to the full bug inbox", async () => {
    await registerUser("Admin", "admin@example.com");
    const reporter = await registerUser("Reporter", "reporter@example.com");

    await request(app)
      .post("/api/bug-reports")
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({
        title: "Board archive countdown",
        message: "The archive countdown badge overlaps the action buttons on narrow screens.",
        pagePath: "/boards"
      });

    const listResponse = await request(app)
      .get("/api/bug-reports")
      .set("Authorization", `Bearer ${reporter.token}`);

    expect(listResponse.status).toBe(403);
  });

  it("lets admins review and triage all bug reports", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const reporter = await registerUser("Reporter", "reporter@example.com");

    const created = await request(app)
      .post("/api/bug-reports")
      .set("Authorization", `Bearer ${reporter.token}`)
      .send({
        title: "Permission banner loops",
        message: "The permission denied banner keeps reappearing after retrying the same restricted action.",
        pagePath: "/threads"
      });

    expect(created.status).toBe(201);
    const reportId = created.body.data.id as string;

    const listResponse = await request(app)
      .get("/api/bug-reports")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(1);
    expect(listResponse.body.data.openCount).toBe(1);
    expect(listResponse.body.data.items[0].reporter.email).toBe("reporter@example.com");

    const updateResponse = await request(app)
      .patch(`/api/bug-reports/${reportId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "triaged" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.status).toBe("triaged");

    const filteredResponse = await request(app)
      .get("/api/bug-reports?status=triaged")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(filteredResponse.status).toBe(200);
    expect(filteredResponse.body.data.items).toHaveLength(1);
    expect(filteredResponse.body.data.items[0].id).toBe(reportId);

    const adminSummary = await request(app)
      .get("/api/bug-reports/summary")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(adminSummary.status).toBe(200);
    expect(adminSummary.body.data.canManageAll).toBe(true);
    expect(adminSummary.body.data.openCount).toBe(0);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
