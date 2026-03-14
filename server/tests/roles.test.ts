import request from "supertest";

const testDbRelative = "./data/flowstate.roles.test.db";

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

async function registerUser(name: string, email: string): Promise<{ token: string; id: string }> {
  const response = await request(app).post("/api/auth/register").send({
    name,
    email,
    password: "password123"
  });

  return { token: response.body.data.token as string, id: response.body.data.user.id as string };
}

describe("Roles API", () => {
  it("lists default roles and creates a role", async () => {
    const admin = await registerUser("Admin", "admin@example.com");

    const listResponse = await request(app)
      .get("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.length).toBeGreaterThanOrEqual(2);

    const createResponse = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        name: "Reviewer",
        color: "#0ea5e9",
        permissions: ["view_boards"]
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.name).toBe("Reviewer");
  });

  it("assigns roles to an existing user", async () => {
    const admin = await registerUser("Admin", "admin@example.com");
    const member = await registerUser("Member", "member@example.com");

    const rolesResponse = await request(app)
      .get("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`);

    const roles = rolesResponse.body.data as Array<{ id: string; name: string }>;
    const memberRole = roles.find((role) => role.name === "Member");

    const createRoleResponse = await request(app)
      .post("/api/roles")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        name: "Designer",
        color: "#ec4899",
        permissions: ["view_boards", "comment"]
      });

    const createdRoleId = createRoleResponse.body.data.id as string;

    const roleIds = [createdRoleId];
    if (memberRole?.id) {
      roleIds.push(memberRole.id);
    }

    const updateResponse = await request(app)
      .patch(`/api/roles/assignments/users/${member.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        roleIds
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.roleIds).toContain(createdRoleId);
  });
});

afterAll(() => {
  clearDatabaseForTests();
});


