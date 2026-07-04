import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db/connection.js";
import {
  rolePermissionsTable,
  roleScopeOverrides,
  roles,
  userRoleAssignments,
  boards,
  boardMembers,
  boardMemberPermissions,
  type RolePermission,
  type RoleScopeType
} from "../db/schema.js";
import { ApiError } from "./api-error.js";

export interface PermissionContext {
  scopeType?: RoleScopeType;
  scopeId?: string;
}

export async function getUserRoleIds(userId: string): Promise<string[]> {
  const rows: Array<{ roleId: string }> = await db
    .select({ roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .where(eq(userRoleAssignments.userId, userId));

  return rows.map((row) => row.roleId);
}

export async function getUserPermissions(userId: string, context?: PermissionContext): Promise<Set<RolePermission>> {
  const roleIds = await getUserRoleIds(userId);
  if (roleIds.length === 0) {
    return new Set();
  }

  const permissions: Array<{ permission: RolePermission }> = await db
    .select({ permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .where(inArray(rolePermissionsTable.roleId, roleIds));

  const effective = new Set<RolePermission>(permissions.map((row) => row.permission));

  if (context?.scopeType && context.scopeId) {
    if (context.scopeType === "board") {
      const boardId = context.scopeId;
      const isSystemAdmin = effective.has("view_all_boards");

      if (!isSystemAdmin) {
        // Fetch board creator
        const [board] = await db
          .select({ createdBy: boards.createdBy })
          .from(boards)
          .where(eq(boards.id, boardId))
          .limit(1);

        const isCreator = board?.createdBy === userId;

        if (!isCreator) {
          // Check if explicitly a member of the board
          const [member] = await db
            .select({ role: boardMembers.role })
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
            .limit(1);

          if (!member) {
            return new Set(); // Strictly block access (empty permission set)
          }
        }
      }
    }

    const overrides: Array<{ permission: RolePermission; access: "allow" | "deny" }> = await db
      .select({ permission: roleScopeOverrides.permission, access: roleScopeOverrides.access })
      .from(roleScopeOverrides)
      .where(
        and(
          inArray(roleScopeOverrides.roleId, roleIds),
          eq(roleScopeOverrides.scopeType, context.scopeType),
          eq(roleScopeOverrides.scopeId, context.scopeId)
        )
      );

    const denied = new Set<RolePermission>();
    const allowed = new Set<RolePermission>();
    for (const override of overrides) {
      if (override.access === "deny") {
        denied.add(override.permission);
      } else {
        allowed.add(override.permission);
      }
    }

    // If context is board scope, also load board member specific overrides
    if (context.scopeType === "board") {
      const boardId = context.scopeId;
      const boardMemberOverrides: Array<{ permission: RolePermission; access: "allow" | "deny" }> = await db
        .select({ permission: boardMemberPermissions.permission, access: boardMemberPermissions.access })
        .from(boardMemberPermissions)
        .where(
          and(
            eq(boardMemberPermissions.boardId, boardId),
            eq(boardMemberPermissions.userId, userId)
          )
        );

      for (const override of boardMemberOverrides) {
        if (override.access === "deny") {
          denied.add(override.permission);
          allowed.delete(override.permission);
        } else {
          allowed.add(override.permission);
          denied.delete(override.permission);
        }
      }
    }

    for (const permission of allowed) {
      if (!denied.has(permission)) {
        effective.add(permission);
      }
    }

    for (const permission of denied) {
      effective.delete(permission);
    }
  }

  return effective;
}

export async function userHasPermission(
  userId: string,
  permission: RolePermission,
  context?: PermissionContext
): Promise<boolean> {
  const permissions = await getUserPermissions(userId, context);
  return permissions.has(permission);
}

export async function assertPermission(
  userId: string,
  permission: RolePermission,
  context?: PermissionContext
): Promise<void> {
  const allowed = await userHasPermission(userId, permission, context);
  if (!allowed) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}

export async function assertAnyPermission(
  userId: string,
  permissions: RolePermission[],
  context?: PermissionContext
): Promise<void> {
  const current = await getUserPermissions(userId, context);
  if (permissions.some((permission) => current.has(permission))) {
    return;
  }
  throw new ApiError(403, "You do not have permission to perform this action");
}

export async function getUserHighestRole(
  userId: string
): Promise<{ id: string; name: string; priority: number } | null> {
  const rows: Array<{ id: string; name: string; priority: number }> = await db
    .select({ id: roles.id, name: roles.name, priority: roles.priority })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, userId))
    .orderBy(desc(roles.priority))
    .limit(1);

  return rows[0] ?? null;
}

export async function assertRoleHierarchy(
  actorId: string,
  rolePriority: number,
  options?: { allowEqual?: boolean }
): Promise<void> {
  const highest = await getUserHighestRole(actorId);
  const allowEqual = options?.allowEqual ?? false;
  if (!highest || highest.priority < rolePriority || (!allowEqual && highest.priority === rolePriority)) {
    throw new ApiError(403, "You cannot manage roles at or above your own role");
  }
}
