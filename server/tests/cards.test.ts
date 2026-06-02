import request from "supertest";
import type { Pool, RowDataPacket } from "mysql2/promise";

const testDbUrl = "mysql://root:root@localhost:3306/flowstate_test";

let app: import("express").Express;
let initializeDatabase: () => Promise<void>;
let clearDatabaseForTests: () => Promise<void>;
let closePool: () => Promise<void>;
let pool: Pool;

interface AuthContext {
  token: string;
  userId: string;
}

async function registerAndGetAuth(email: string, name = "User"): Promise<AuthContext> {
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
    userId: response.body.data.user.id as string
  };
}

async function getRoleIdByName(token: string, name: string): Promise<string> {
  const response = await request(app)
    .get("/api/roles")
    .set("Authorization", `Bearer ${token}`);

  const role = (response.body.data as Array<{ id: string; name: string }>).find((entry) => entry.name === name);
  if (!role) {
    throw new Error(`Role ${name} not found`);
  }

  return role.id;
}

async function assignRoles(token: string, userId: string, roleIds: string[]): Promise<void> {
  const response = await request(app)
    .patch(`/api/roles/assignments/users/${userId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({ roleIds });

  if (response.status !== 200) {
    throw new Error(`Failed to assign roles: ${response.status} ${JSON.stringify(response.body)}`);
  }
}

async function allowBoardPermissions(roleId: string, boardId: string, permissions: string[]): Promise<void> {
  for (const permission of permissions) {
    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, ?, 'allow', NOW(3))",
      [roleId, boardId, permission]
    );
  }
}

async function createBoardWithDefaults(token: string, name = "Phase 3 Board"): Promise<{
  boardId: string;
  todoListId: string;
  inProgressListId: string;
  doneListId: string;
}> {
  const response = await request(app)
    .post("/api/boards")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name,
      background: "teal-gradient"
    });

  if (response.status !== 201) {
    throw new Error(`Board creation failed: ${response.status} ${JSON.stringify(response.body)}`);
  }

  const boardId = response.body.data.id as string;
  const lists = response.body.data.lists as Array<{ id: string; name: string }>;

  const todoListId = lists.find((list) => list.name === "To Do")?.id;
  const inProgressListId = lists.find((list) => list.name === "In Progress")?.id;
  const doneListId = lists.find((list) => list.name === "Done")?.id;

  if (!todoListId || !inProgressListId || !doneListId) {
    throw new Error("Default lists not found");
  }

  return { boardId, todoListId, inProgressListId, doneListId };
}

function cardPayload(title: string, assigneeId: string, dueDate = "2026-03-20T10:00:00.000Z") {
  return {
    title,
    dueDate,
    assigneeIds: [assigneeId]
  };
}

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
  pool = dbModule.pool;

  await initializeDatabase();
});

beforeEach(async () => {
  await clearDatabaseForTests();
});

describe("Cards API", () => {
  it("requires auth to create cards", async () => {
    const response = await request(app).post("/api/boards/lists/not-a-list/cards").send({
      title: "Task"
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("creates boards with done-list cleanup disabled by default", async () => {
    const auth = await registerAndGetAuth("retention-default@example.com", "Retention User");
    const { boardId } = await createBoardWithDefaults(auth.token, "Retention Default Board");

    const [rows] = await pool.query<Array<RowDataPacket & { retention_minutes: number }>>(
      "SELECT retention_minutes FROM boards WHERE id = ?",
      [boardId]
    );

    expect(rows[0]?.retention_minutes).toBe(0);
  });

  it("creates card, updates it, and returns cards in board detail", async () => {
    const auth = await registerAndGetAuth("owner@example.com", "Owner");
    const { boardId, todoListId } = await createBoardWithDefaults(auth.token);

    const createResponse = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        ...cardPayload("API integration", auth.userId),
        title: "API integration",
        description: "Implement create card endpoint",
        priority: "high"
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.title).toBe("API integration");
    expect(createResponse.body.data.priority).toBe("high");

    const cardId = createResponse.body.data.id as string;

    const updateResponse = await request(app)
      .patch(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        title: "API integration done",
        dueDate: "2026-03-20T10:00:00.000Z",
        priority: "urgent"
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.title).toBe("API integration done");
    expect(updateResponse.body.data.priority).toBe("urgent");
    expect(updateResponse.body.data.dueDate).toBe("2026-03-20T10:00:00.000Z");

    const boardResponse = await request(app)
      .get(`/api/boards/${boardId}`)
      .set("Authorization", `Bearer ${auth.token}`);

    const todo = boardResponse.body.data.lists.find((list: { id: string }) => list.id === todoListId) as {
      cards: Array<{ id: string; title: string }>;
    };

    expect(todo.cards).toHaveLength(1);
    expect(todo.cards[0].id).toBe(cardId);
    expect(todo.cards[0].title).toBe("API integration done");
  });

  it("requires set_due_dates permission when editing a card due date", async () => {
    const admin = await registerAndGetAuth("admin-due-edit@example.com", "Admin User");
    const member = await registerAndGetAuth("member-due-edit@example.com", "Member User");
    const memberRoleId = await getRoleIdByName(admin.token, "Member");
    await assignRoles(admin.token, member.userId, [memberRoleId]);

    const { boardId, todoListId } = await createBoardWithDefaults(member.token, "Due Date Edit Board");
    const createResponse = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${member.token}`)
      .send(cardPayload("Due permission card", member.userId));

    expect(createResponse.status).toBe(201);
    const cardId = createResponse.body.data.id as string;

    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, 'set_due_dates', 'deny', NOW(3))",
      [memberRoleId, boardId]
    );

    const titleOnlyUpdate = await request(app)
      .patch(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ title: "Title-only update still allowed" });

    expect(titleOnlyUpdate.status).toBe(200);

    const dueDateUpdate = await request(app)
      .patch(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ dueDate: "2026-03-21T10:00:00.000Z" });

    expect(dueDateUpdate.status).toBe(403);
  });

  it("requires a due date and assignee when creating cards", async () => {
    const auth = await registerAndGetAuth("required-fields@example.com", "Required User");
    const { todoListId } = await createBoardWithDefaults(auth.token, "Required Fields Board");

    const missingDueDate = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        title: "Missing due date",
        assigneeIds: [auth.userId]
      });

    expect(missingDueDate.status).toBe(400);

    const missingAssignee = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        title: "Missing assignee",
        dueDate: "2026-03-20T10:00:00.000Z"
      });

    expect(missingAssignee.status).toBe(400);
  });

  it("moves cards across lists and tracks doneEnteredAt", async () => {
    const auth = await registerAndGetAuth("drag@example.com", "Drag User");
    const { todoListId, doneListId } = await createBoardWithDefaults(auth.token, "Move Board");

    const firstCard = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send(cardPayload("Card A", auth.userId));

    const secondCard = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send(cardPayload("Card B", auth.userId));

    const firstCardId = firstCard.body.data.id as string;
    const secondCardId = secondCard.body.data.id as string;

    const reorderInSameList = await request(app)
      .post("/api/boards/cards/move")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        cardId: secondCardId,
        sourceListId: todoListId,
        destinationListId: todoListId,
        destinationIndex: 0
      });

    expect(reorderInSameList.status).toBe(200);
    expect(reorderInSameList.body.data.sourceCards[0].id).toBe(secondCardId);

    const moveToDone = await request(app)
      .post("/api/boards/cards/move")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        cardId: firstCardId,
        sourceListId: todoListId,
        destinationListId: doneListId,
        destinationIndex: 0
      });

    expect(moveToDone.status).toBe(200);
    expect(moveToDone.body.data.destinationCards[0].id).toBe(firstCardId);
    expect(moveToDone.body.data.destinationCards[0].doneEnteredAt).toEqual(expect.any(String));

    const moveBackToTodo = await request(app)
      .post("/api/boards/cards/move")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({
        cardId: firstCardId,
        sourceListId: doneListId,
        destinationListId: todoListId,
        destinationIndex: 1
      });

    expect(moveBackToTodo.status).toBe(200);
    const movedBackCard = moveBackToTodo.body.data.destinationCards.find((card: { id: string }) => card.id === firstCardId);
    expect(movedBackCard.doneEnteredAt).toBeNull();
  });

  it("enforces delete permissions for non-admin users", async () => {
    const admin = await registerAndGetAuth("admin@example.com", "Admin User");
    const memberOne = await registerAndGetAuth("member-one@example.com", "Member One");
    const memberTwo = await registerAndGetAuth("member-two@example.com", "Member Two");

    const memberRoleId = await getRoleIdByName(admin.token, "Member");
    await assignRoles(admin.token, memberOne.userId, [memberRoleId]);
    await assignRoles(admin.token, memberTwo.userId, [memberRoleId]);

    const { todoListId } = await createBoardWithDefaults(memberOne.token, "Delete Permission Board");

    const createdCard = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${memberOne.token}`)
      .send(cardPayload("Protected card", memberOne.userId));

    const cardId = createdCard.body.data.id as string;

    const forbiddenDelete = await request(app)
      .delete(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${memberTwo.token}`);

    expect(forbiddenDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/api/boards/cards/${cardId}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(adminDelete.status).toBe(200);
  });

  it("respects board-scoped overrides when creating cards", async () => {
    const admin = await registerAndGetAuth("admin@example.com", "Admin User");
    const guest = await registerAndGetAuth("guest@example.com", "Guest User");
    const deniedMember = await registerAndGetAuth("denied-member@example.com", "Denied Member");

    const memberRoleId = await getRoleIdByName(admin.token, "Member");
    const [guestRoleRows] = await pool.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM roles WHERE name = ?", ["Guest"]);
    const guestRoleId = guestRoleRows[0]?.id;

    expect(guestRoleId).toBeTruthy();
    await assignRoles(admin.token, deniedMember.userId, [memberRoleId]);

    const allowBoard = await createBoardWithDefaults(admin.token, "Override Allow Board");
    const denyBoard = await createBoardWithDefaults(admin.token, "Override Deny Board");

    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, ?, 'allow', NOW(3))",
      [guestRoleId, allowBoard.boardId, "create_cards"]
    );
    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, ?, 'allow', NOW(3))",
      [guestRoleId, allowBoard.boardId, "assign_members"]
    );
    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, ?, 'allow', NOW(3))",
      [guestRoleId, allowBoard.boardId, "set_due_dates"]
    );

    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, 'create_cards', 'deny', NOW(3))",
      [memberRoleId, denyBoard.boardId]
    );

    const allowedCreate = await request(app)
      .post(`/api/boards/lists/${allowBoard.todoListId}/cards`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send(cardPayload("Override-created card", guest.userId));

    expect(allowedCreate.status).toBe(201);
    expect(allowedCreate.body.data.title).toBe("Override-created card");

    await assignRoles(admin.token, guest.userId, [guestRoleId, memberRoleId]);
    await pool.query(
      "INSERT INTO role_scope_overrides (role_id, scope_type, scope_id, permission, access, created_at) VALUES (?, 'board', ?, 'create_cards', 'deny', NOW(3))",
      [memberRoleId, allowBoard.boardId]
    );

    const conflictingCreate = await request(app)
      .post(`/api/boards/lists/${allowBoard.todoListId}/cards`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send(cardPayload("Deny should win", guest.userId));

    expect(conflictingCreate.status).toBe(403);

    const deniedCreate = await request(app)
      .post(`/api/boards/lists/${denyBoard.todoListId}/cards`)
      .set("Authorization", `Bearer ${deniedMember.token}`)
      .send(cardPayload("Should be blocked", deniedMember.userId));

    expect(deniedCreate.status).toBe(403);
  });

  it("respects board-scoped overrides for board child resources", async () => {
    const admin = await registerAndGetAuth("admin-child-overrides@example.com", "Admin User");
    const guest = await registerAndGetAuth("guest-child-overrides@example.com", "Guest User");

    const [guestRoleRows] = await pool.query<Array<RowDataPacket & { id: string }>>("SELECT id FROM roles WHERE name = ?", ["Guest"]);
    const guestRoleId = guestRoleRows[0]?.id;
    expect(guestRoleId).toBeTruthy();

    const { boardId, todoListId } = await createBoardWithDefaults(admin.token, "Child Override Board");
    await allowBoardPermissions(guestRoleId, boardId, [
      "comment",
      "manage_checklists",
      "manage_labels",
      "manage_lists",
      "upload_files"
    ]);

    const createListResponse = await request(app)
      .post(`/api/boards/${boardId}/lists`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ name: "Guest-managed list" });

    expect(createListResponse.status).toBe(201);

    const createLabelResponse = await request(app)
      .post(`/api/boards/${boardId}/labels`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ name: "Guest label", color: "teal" });

    expect(createLabelResponse.status).toBe(201);

    const createCardResponse = await request(app)
      .post(`/api/boards/lists/${todoListId}/cards`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send(cardPayload("Admin-created child resource card", admin.userId));

    expect(createCardResponse.status).toBe(201);
    const cardId = createCardResponse.body.data.id as string;

    const createChecklistResponse = await request(app)
      .post(`/api/boards/cards/${cardId}/checklists`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ title: "Guest checklist" });

    expect(createChecklistResponse.status).toBe(201);

    const createAttachmentResponse = await request(app)
      .post(`/api/boards/cards/${cardId}/attachments`)
      .set("Authorization", `Bearer ${guest.token}`)
      .attach("files", Buffer.from("hello"), "hello.txt");

    expect(createAttachmentResponse.status).toBe(201);

    const createCommentResponse = await request(app)
      .post(`/api/boards/${boardId}/comments`)
      .set("Authorization", `Bearer ${guest.token}`)
      .send({ body: "Guest comment through board override" });

    expect(createCommentResponse.status).toBe(201);
  });
});

afterAll(async () => {
  await clearDatabaseForTests();
  await closePool();
});
