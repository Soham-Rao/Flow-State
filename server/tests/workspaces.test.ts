import bcrypt from "bcryptjs";
import request from "supertest";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";
const creationPassword = "owner-only-workspace-password";

let app: import("express").Express;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;
let runMigrationPostchecks: () => Promise<void>;
let env: typeof import("../src/config/env.js").env;

async function register(name: string, email: string): Promise<{ id: string; token: string }> {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123",
    acceptedLegalTerms: true
  });
  return {
    id: response.body.data.user.id as string,
    token: response.body.data.token as string
  };
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.MYSQL_URL = testDbUrl;
  process.env.JWT_SECRET = "test-secret-123456";
  process.env.JWT_EXPIRES_IN = "1h";
  process.env.CLIENT_ORIGIN = "http://localhost:5173";
  process.env.TEST_EXPLICIT_WORKSPACES = "true";

  const appModule = await import("../src/app.js");
  const dbInitModule = await import("../src/db/init.js");
  const dbModule = await import("../src/db/connection.js");
  const migrationGuardModule = await import("../src/db/migration-guard.js");
  const envModule = await import("../src/config/env.js");

  app = appModule.app;
  clearDatabaseForTests = dbInitModule.clearDatabaseForTests;
  closePool = dbModule.closePool;
  runMigrationPostchecks = migrationGuardModule.runMigrationPostchecks;
  env = envModule.env;
  await dbInitModule.initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
  env.WORKSPACE_CREATION_PASSWORD_HASH = bcrypt.hashSync(creationPassword, 4);
});

describe("Workspace tenancy", () => {
  it("leaves a new account workspace-less until it explicitly creates or joins one", async () => {
    const user = await register("Existing User", "existing@example.com");
    const response = await request(app)
      .get("/api/workspaces")
      .set("Authorization", `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    await expect(runMigrationPostchecks()).resolves.toBeUndefined();
  });

  it("allows any authenticated user with the private password to create a workspace", async () => {
    const owner = await register("Owner", "owner@example.com");
    const other = await register("Other", "other@example.com");
    const ownerCapabilities = await request(app)
      .get("/api/workspaces/capabilities")
      .set("Authorization", `Bearer ${owner.token}`);
    const otherCapabilities = await request(app)
      .get("/api/workspaces/capabilities")
      .set("Authorization", `Bearer ${other.token}`);
    expect(ownerCapabilities.body.data.canCreateWorkspace).toBe(true);
    expect(otherCapabilities.body.data.canCreateWorkspace).toBe(true);

    const wrongPassword = await request(app)
      .post("/api/workspaces")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Second Workspace", joinCode: "members-only-code", password: "wrong" });
    expect(wrongPassword.status).toBe(403);

    const created = await request(app)
      .post("/api/workspaces")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ name: "Second Workspace", joinCode: "members-only-code", password: creationPassword });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe("Second Workspace");
    expect(created.body.data.role).toBe("admin");
  });

  it("prevents a member of one workspace from addressing another workspace", async () => {
    const owner = await register("Owner", "owner@example.com");
    const isolatedUser = await register("Isolated", "isolated@example.com");
    const workspaceResponse = await request(app)
      .post("/api/workspaces")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Private Workspace", joinCode: "private-team-code", password: creationPassword });
    const privateWorkspaceId = workspaceResponse.body.data.id as string;

    const createBoardResponse = await request(app)
      .post("/api/boards")
      .set("Authorization", `Bearer ${owner.token}`)
      .set("X-Workspace-Id", privateWorkspaceId)
      .send({ name: "Private Board", background: "teal-gradient" });
    expect(createBoardResponse.status).toBe(201);

    const crossWorkspaceList = await request(app)
      .get("/api/boards")
      .set("Authorization", `Bearer ${isolatedUser.token}`)
      .set("X-Workspace-Id", privateWorkspaceId);
    expect(crossWorkspaceList.status).toBe(403);

    const wrongCode = await request(app)
      .post("/api/workspaces/join")
      .set("Authorization", `Bearer ${isolatedUser.token}`)
      .send({ name: "Private Workspace", joinCode: "wrong-code" });
    expect(wrongCode.status).toBe(403);

    const joined = await request(app)
      .post("/api/workspaces/join")
      .set("Authorization", `Bearer ${isolatedUser.token}`)
      .send({ name: "Private Workspace", joinCode: "private-team-code" });
    expect(joined.status).toBe(200);
    expect(joined.body.data.role).toBe("member");

    const listAfterJoin = await request(app)
      .get("/api/boards")
      .set("Authorization", `Bearer ${isolatedUser.token}`)
      .set("X-Workspace-Id", privateWorkspaceId);
    expect(listAfterJoin.status).toBe(200);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
  delete process.env.TEST_EXPLICIT_WORKSPACES;
});
