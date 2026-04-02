import crypto from "node:crypto";

import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/connection.js";
import {
  rolePermissionsTable,
  roles,
  userRoleAssignments,
  users,
  type RolePermission,
  type UserRole
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertRoleHierarchy } from "../../utils/permissions.js";
import type { CreateRoleInput, UpdateRoleInput } from "./roles.schema.js";

type RoleRow = typeof roles.$inferSelect;

const ADMIN_ROLE_NAME = "Admin";
const MEMBER_ROLE_NAME = "Member";
const GUEST_ROLE_NAME = "Guest";

export interface RoleSummary {
  id: string;
  name: string;
  color: string;
  priority: number;
  mentionable: boolean;
  isSystem: boolean;
  permissions: RolePermission[];
}

export interface UserRoleAssignment {
  id: string;
  name: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: UserRole;
  roleIds: string[];
}

function normalizeRoleIds(roleIds: string[]): string[] {
  return Array.from(new Set(roleIds));
}

async function getSystemRoles(): Promise<{
  admin: typeof roles.$inferSelect;
  member: typeof roles.$inferSelect;
  guest: typeof roles.$inferSelect;
}> {
  const rows: RoleRow[] = await db
    .select()
    .from(roles)
    .where(inArray(roles.name, [ADMIN_ROLE_NAME, MEMBER_ROLE_NAME, GUEST_ROLE_NAME]));

  const admin = rows.find((row) => row.name === ADMIN_ROLE_NAME);
  const member = rows.find((row) => row.name === MEMBER_ROLE_NAME);
  const guest = rows.find((row) => row.name === GUEST_ROLE_NAME);

  if (!admin || !member || !guest) {
    throw new ApiError(500, "System roles are missing. Run migrations or reinitialize the database.");
  }

  return { admin, member, guest };
}

export async function getSystemRoleIds(): Promise<{ adminRoleId: string; memberRoleId: string; guestRoleId: string }> {
  const { admin, member, guest } = await getSystemRoles();
  return { adminRoleId: admin.id, memberRoleId: member.id, guestRoleId: guest.id };
}

async function resolveLegacyRole(roleIds: string[]): Promise<UserRole> {
  const { adminRoleId, memberRoleId } = await getSystemRoleIds();
  if (roleIds.includes(adminRoleId)) {
    return "admin";
  }
  if (roleIds.includes(memberRoleId)) {
    return "member";
  }
  return "guest";
}

async function getPermissionsForRoles(roleIds: string[]): Promise<Map<string, RolePermission[]>> {
  if (roleIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ roleId: rolePermissionsTable.roleId, permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .where(inArray(rolePermissionsTable.roleId, roleIds));

  const map = new Map<string, RolePermission[]>();
  for (const row of rows) {
    const list = map.get(row.roleId) ?? [];
    list.push(row.permission);
    map.set(row.roleId, list);
  }

  return map;
}

async function getMaxPriorityBelow(limit: number): Promise<number> {
  const rows = await db
    .select({ maxPriority: sql<number | null>`max(${roles.priority})` })
    .from(roles)
    .where(lt(roles.priority, limit))
    .limit(1);

  const maxPriority = rows[0]?.maxPriority ?? limit - 1;
  return Math.max(1, Math.min(maxPriority, limit - 1));
}

function isReservedRoleName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return [ADMIN_ROLE_NAME, MEMBER_ROLE_NAME, GUEST_ROLE_NAME]
    .some((roleName) => roleName.toLowerCase() === normalized);
}

export async function listRoles(): Promise<RoleSummary[]> {
  const rows: RoleRow[] = await db
    .select()
    .from(roles)
    .orderBy(desc(roles.priority), roles.name);

  const permissionsMap = await getPermissionsForRoles(rows.map((row) => row.id));

  return rows.map((role) => ({
    id: role.id,
    name: role.name,
    color: role.color,
    priority: role.priority,
    mentionable: role.mentionable,
    isSystem: role.isSystem,
    permissions: permissionsMap.get(role.id) ?? []
  }));
}

export async function createRole(input: CreateRoleInput, actorId: string): Promise<RoleSummary> {
  const name = input.name.trim();
  if (isReservedRoleName(name)) {
    throw new ApiError(409, "That role name is reserved");
  }

  const existingRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, name))
    .limit(1);
  if (existingRows[0]) {
    throw new ApiError(409, "Role name already exists");
  }

  const actorHighestRows = await db
    .select({ priority: roles.priority })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, actorId))
    .orderBy(desc(roles.priority))
    .limit(1);

  const actorHighest = actorHighestRows[0];

  if (!actorHighest) {
    throw new ApiError(403, "You cannot create roles without a role assigned");
  }

  const priority = input.priority ?? await getMaxPriorityBelow(actorHighest.priority);
  await assertRoleHierarchy(actorId, priority);

  const roleId = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(roles)
      .values({
        id: roleId,
        name,
        color: input.color,
        priority,
        mentionable: input.mentionable ?? false,
        isSystem: false,
        createdAt: now,
        updatedAt: now
      })
      .execute();

    await tx.insert(rolePermissionsTable)
      .values(input.permissions.map((permission) => ({ roleId, permission, createdAt: now })))
      .execute();
  });

  return {
    id: roleId,
    name,
    color: input.color,
    priority,
    mentionable: input.mentionable ?? false,
    isSystem: false,
    permissions: input.permissions
  };
}

export async function updateRole(roleId: string, input: UpdateRoleInput, actorId: string): Promise<RoleSummary> {
  const roleRows: RoleRow[] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  const role = roleRows[0];
  if (!role) {
    throw new ApiError(404, "Role not found");
  }

  if (role.isSystem) {
    if (input.name || input.permissions || input.priority) {
      throw new ApiError(403, "System roles cannot be renamed or re-permissioned");
    }
  }

  const nextName = input.name?.trim() ?? role.name;
  if (input.name && isReservedRoleName(nextName)) {
    throw new ApiError(409, "That role name is reserved");
  }

  if (input.name) {
    const existingRows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, nextName), ne(roles.id, roleId)))
      .limit(1);

    if (existingRows[0]) {
      throw new ApiError(409, "Role name already exists");
    }
  }

  const nextPriority = input.priority ?? role.priority;
  await assertRoleHierarchy(actorId, nextPriority);

  const now = new Date();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.update(roles)
      .set({
        name: nextName,
        color: input.color ?? role.color,
        priority: nextPriority,
        mentionable: input.mentionable ?? role.mentionable,
        updatedAt: now
      })
      .where(eq(roles.id, roleId))
      .execute();

    if (input.permissions) {
      await tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId)).execute();
      await tx.insert(rolePermissionsTable)
        .values(input.permissions.map((permission) => ({ roleId, permission, createdAt: now })))
        .execute();
    }
  });

  const permissions = input.permissions ?? (await getPermissionsForRoles([roleId])).get(roleId) ?? [];

  return {
    id: roleId,
    name: nextName,
    color: input.color ?? role.color,
    priority: nextPriority,
    mentionable: input.mentionable ?? role.mentionable,
    isSystem: role.isSystem,
    permissions
  };
}

export async function deleteRole(roleId: string, actorId: string): Promise<void> {
  const roleRows: RoleRow[] = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  const role = roleRows[0];
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  if (role.isSystem) {
    throw new ApiError(403, "System roles cannot be deleted");
  }

  await assertRoleHierarchy(actorId, role.priority);

  await db.delete(roles).where(eq(roles.id, roleId)).execute();
}

export async function listRoleAssignments(): Promise<UserRoleAssignment[]> {
  const usersRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const assignments = await db
    .select({ userId: userRoleAssignments.userId, roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments);

  const map = new Map<string, string[]>();
  for (const row of assignments) {
    const list = map.get(row.userId) ?? [];
    list.push(row.roleId);
    map.set(row.userId, list);
  }

  const results: UserRoleAssignment[] = [];
  for (const user of usersRows) {
    const roleIds = normalizeRoleIds(map.get(user.id) ?? []);
    const legacyRole = roleIds.length > 0 ? await resolveLegacyRole(roleIds) : user.role;
    results.push({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName ?? null,
      role: legacyRole,
      roleIds
    });
  }

  return results;
}

export async function updateUserRoles(userId: string, roleIds: string[], actorId: string): Promise<UserRoleAssignment> {
  const uniqueRoleIds = normalizeRoleIds(roleIds);
  if (uniqueRoleIds.length === 0) {
    throw new ApiError(400, "At least one role is required");
  }

  const userRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userRows[0];

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const rolesRows: Array<{ id: string; priority: number }> = await db
    .select({ id: roles.id, priority: roles.priority })
    .from(roles)
    .where(inArray(roles.id, uniqueRoleIds));

  if (rolesRows.length !== uniqueRoleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }

  for (const role of rolesRows) {
    await assertRoleHierarchy(actorId, role.priority);
  }

  const now = new Date();
  await db.transaction(async (tx: DbTransaction) => {
    await tx.delete(userRoleAssignments).where(eq(userRoleAssignments.userId, userId)).execute();
    await tx.insert(userRoleAssignments)
      .values(uniqueRoleIds.map((roleId) => ({ userId, roleId, createdAt: now })))
      .execute();

    const legacyRole = await resolveLegacyRole(uniqueRoleIds);
    await tx.update(users).set({ role: legacyRole, updatedAt: now }).where(eq(users.id, userId)).execute();
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username ?? null,
    displayName: user.displayName ?? null,
    role: await resolveLegacyRole(uniqueRoleIds),
    roleIds: uniqueRoleIds
  };
}

export async function setUserRoles(userId: string, roleIds: string[]): Promise<void> {
  const uniqueRoleIds = normalizeRoleIds(roleIds);
  if (uniqueRoleIds.length === 0) {
    throw new ApiError(400, "At least one role is required");
  }

  const rolesRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, uniqueRoleIds));

  if (rolesRows.length !== uniqueRoleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }

  const now = new Date();
  await db.transaction(async (tx: DbTransaction) => {
    await tx.delete(userRoleAssignments).where(eq(userRoleAssignments.userId, userId)).execute();
    await tx.insert(userRoleAssignments)
      .values(uniqueRoleIds.map((roleId) => ({ userId, roleId, createdAt: now })))
      .execute();

    const legacyRole = await resolveLegacyRole(uniqueRoleIds);
    await tx.update(users).set({ role: legacyRole, updatedAt: now }).where(eq(users.id, userId)).execute();
  });
}
