import crypto from "node:crypto";

import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
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

function getSystemRoles(): {
  admin: typeof roles.$inferSelect;
  member: typeof roles.$inferSelect;
  guest: typeof roles.$inferSelect;
} {
  const rows = db
    .select()
    .from(roles)
    .where(inArray(roles.name, [ADMIN_ROLE_NAME, MEMBER_ROLE_NAME, GUEST_ROLE_NAME]))
    .all();

  const admin = rows.find((row) => row.name === ADMIN_ROLE_NAME);
  const member = rows.find((row) => row.name === MEMBER_ROLE_NAME);
  const guest = rows.find((row) => row.name === GUEST_ROLE_NAME);

  if (!admin || !member || !guest) {
    throw new ApiError(500, "System roles are missing. Run migrations or reinitialize the database.");
  }

  return { admin, member, guest };
}

export function getSystemRoleIds(): { adminRoleId: string; memberRoleId: string; guestRoleId: string } {
  const { admin, member, guest } = getSystemRoles();
  return { adminRoleId: admin.id, memberRoleId: member.id, guestRoleId: guest.id };
}


function resolveLegacyRole(roleIds: string[]): UserRole {
  const { adminRoleId, memberRoleId } = getSystemRoleIds();
  if (roleIds.includes(adminRoleId)) {
    return "admin";
  }
  if (roleIds.includes(memberRoleId)) {
    return "member";
  }
  return "guest";
}

function getPermissionsForRoles(roleIds: string[]): Map<string, RolePermission[]> {
  if (roleIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({ roleId: rolePermissionsTable.roleId, permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .where(inArray(rolePermissionsTable.roleId, roleIds))
    .all();

  const map = new Map<string, RolePermission[]>();
  for (const row of rows) {
    const list = map.get(row.roleId) ?? [];
    list.push(row.permission);
    map.set(row.roleId, list);
  }

  return map;
}

function getMaxPriorityBelow(limit: number): number {
  const row = db
    .select({ maxPriority: sql<number | null>`max(${roles.priority})` })
    .from(roles)
    .where(lt(roles.priority, limit))
    .get();

  const maxPriority = row?.maxPriority ?? limit - 1;
  return Math.max(1, Math.min(maxPriority, limit - 1));
}

function isReservedRoleName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return [ADMIN_ROLE_NAME, MEMBER_ROLE_NAME, GUEST_ROLE_NAME]
    .some((roleName) => roleName.toLowerCase() === normalized);
}

export function listRoles(): RoleSummary[] {
  const rows = db
    .select()
    .from(roles)
    .orderBy(desc(roles.priority), roles.name)
    .all();

  const permissionsMap = getPermissionsForRoles(rows.map((row) => row.id));

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

export function createRole(input: CreateRoleInput, actorId: string): RoleSummary {
  const name = input.name.trim();
  if (isReservedRoleName(name)) {
    throw new ApiError(409, "That role name is reserved");
  }

  const existing = db.select({ id: roles.id }).from(roles).where(eq(roles.name, name)).limit(1).get();
  if (existing) {
    throw new ApiError(409, "Role name already exists");
  }

  const actorHighest = db
    .select({ priority: roles.priority })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, actorId))
    .orderBy(desc(roles.priority))
    .limit(1)
    .get();

  if (!actorHighest) {
    throw new ApiError(403, "You cannot create roles without a role assigned");
  }

  const priority = input.priority ?? getMaxPriorityBelow(actorHighest.priority);
  assertRoleHierarchy(actorId, priority);

  const roleId = crypto.randomUUID();
  const now = new Date();

  db.transaction((tx) => {
    tx.insert(roles)
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
      .run();

    tx.insert(rolePermissionsTable)
      .values(input.permissions.map((permission) => ({ roleId, permission, createdAt: now })))
      .run();
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

export function updateRole(roleId: string, input: UpdateRoleInput, actorId: string): RoleSummary {
  const role = db.select().from(roles).where(eq(roles.id, roleId)).limit(1).get();
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
    const existing = db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.name, nextName), ne(roles.id, roleId)))
      .limit(1)
      .get();

    if (existing) {
      throw new ApiError(409, "Role name already exists");
    }
  }

  const nextPriority = input.priority ?? role.priority;
  assertRoleHierarchy(actorId, nextPriority);

  const now = new Date();

  db.transaction((tx) => {
    tx.update(roles)
      .set({
        name: nextName,
        color: input.color ?? role.color,
        priority: nextPriority,
        mentionable: input.mentionable ?? role.mentionable,
        updatedAt: now
      })
      .where(eq(roles.id, roleId))
      .run();

    if (input.permissions) {
      tx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId)).run();
      tx.insert(rolePermissionsTable)
        .values(input.permissions.map((permission) => ({ roleId, permission, createdAt: now })))
        .run();
    }
  });

  const permissions = input.permissions ?? getPermissionsForRoles([roleId]).get(roleId) ?? [];

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

export function deleteRole(roleId: string, actorId: string): void {
  const role = db.select().from(roles).where(eq(roles.id, roleId)).limit(1).get();
  if (!role) {
    throw new ApiError(404, "Role not found");
  }
  if (role.isSystem) {
    throw new ApiError(403, "System roles cannot be deleted");
  }

  assertRoleHierarchy(actorId, role.priority);

  db.delete(roles).where(eq(roles.id, roleId)).run();
}

export function listRoleAssignments(): UserRoleAssignment[] {
  const usersRows = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      username: users.username,
      displayName: users.displayName,
      role: users.role
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();

  const assignments = db
    .select({ userId: userRoleAssignments.userId, roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .all();

  const map = new Map<string, string[]>();
  for (const row of assignments) {
    const list = map.get(row.userId) ?? [];
    list.push(row.roleId);
    map.set(row.userId, list);
  }

  return usersRows.map((user) => {
    const roleIds = normalizeRoleIds(map.get(user.id) ?? []);
    const legacyRole = roleIds.length > 0 ? resolveLegacyRole(roleIds) : user.role;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username ?? null,
      displayName: user.displayName ?? null,
      role: legacyRole,
      roleIds
    };
  });
}

export function updateUserRoles(userId: string, roleIds: string[], actorId: string): UserRoleAssignment {
  const uniqueRoleIds = normalizeRoleIds(roleIds);
  if (uniqueRoleIds.length === 0) {
    throw new ApiError(400, "At least one role is required");
  }

  const user = db
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
    .limit(1)
    .get();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const rolesRows = db
    .select({ id: roles.id, priority: roles.priority })
    .from(roles)
    .where(inArray(roles.id, uniqueRoleIds))
    .all();

  if (rolesRows.length !== uniqueRoleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }

  for (const role of rolesRows) {
    assertRoleHierarchy(actorId, role.priority);
  }

  const now = new Date();
  db.transaction((tx) => {
    tx.delete(userRoleAssignments).where(eq(userRoleAssignments.userId, userId)).run();
    tx.insert(userRoleAssignments)
      .values(uniqueRoleIds.map((roleId) => ({ userId, roleId, createdAt: now })))
      .run();

    const legacyRole = resolveLegacyRole(uniqueRoleIds);
    tx.update(users).set({ role: legacyRole, updatedAt: now }).where(eq(users.id, userId)).run();
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username ?? null,
    displayName: user.displayName ?? null,
    role: resolveLegacyRole(uniqueRoleIds),
    roleIds: uniqueRoleIds
  };
}

export function setUserRoles(userId: string, roleIds: string[]): void {
  const uniqueRoleIds = normalizeRoleIds(roleIds);
  if (uniqueRoleIds.length === 0) {
    throw new ApiError(400, "At least one role is required");
  }

  const rolesRows = db
    .select({ id: roles.id })
    .from(roles)
    .where(inArray(roles.id, uniqueRoleIds))
    .all();

  if (rolesRows.length !== uniqueRoleIds.length) {
    throw new ApiError(400, "One or more roles are invalid");
  }

  const now = new Date();
  db.transaction((tx) => {
    tx.delete(userRoleAssignments).where(eq(userRoleAssignments.userId, userId)).run();
    tx.insert(userRoleAssignments)
      .values(uniqueRoleIds.map((roleId) => ({ userId, roleId, createdAt: now })))
      .run();

    const legacyRole = resolveLegacyRole(uniqueRoleIds);
    tx.update(users).set({ role: legacyRole, updatedAt: now }).where(eq(users.id, userId)).run();
  });
}

