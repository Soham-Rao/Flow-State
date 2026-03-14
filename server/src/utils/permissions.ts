import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "../db/connection.js";
import {
  rolePermissionsTable,
  roleScopeOverrides,
  roles,
  userRoleAssignments,
  type RolePermission,
  type RoleScopeType
} from "../db/schema.js";
import { ApiError } from "./api-error.js";

export interface PermissionContext {
  scopeType?: RoleScopeType;
  scopeId?: string;
}

export function getUserRoleIds(userId: string): string[] {
  return db
    .select({ roleId: userRoleAssignments.roleId })
    .from(userRoleAssignments)
    .where(eq(userRoleAssignments.userId, userId))
    .all()
    .map((row) => row.roleId);
}

export function getUserPermissions(userId: string, context?: PermissionContext): Set<RolePermission> {
  const roleIds = getUserRoleIds(userId);
  if (roleIds.length === 0) {
    return new Set();
  }

  const permissions = db
    .select({ permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .where(inArray(rolePermissionsTable.roleId, roleIds))
    .all();

  const effective = new Set<RolePermission>(permissions.map((row) => row.permission));

  if (context?.scopeType && context.scopeId) {
    const overrides = db
      .select({ permission: roleScopeOverrides.permission, access: roleScopeOverrides.access })
      .from(roleScopeOverrides)
      .where(
        and(
          inArray(roleScopeOverrides.roleId, roleIds),
          eq(roleScopeOverrides.scopeType, context.scopeType),
          eq(roleScopeOverrides.scopeId, context.scopeId)
        )
      )
      .all();

    for (const override of overrides) {
      if (override.access === "deny") {
        effective.delete(override.permission);
      } else {
        effective.add(override.permission);
      }
    }
  }

  return effective;
}

export function userHasPermission(userId: string, permission: RolePermission, context?: PermissionContext): boolean {
  return getUserPermissions(userId, context).has(permission);
}

export function assertPermission(userId: string, permission: RolePermission, context?: PermissionContext): void {
  if (!userHasPermission(userId, permission, context)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}

export function assertAnyPermission(userId: string, permissions: RolePermission[], context?: PermissionContext): void {
  const current = getUserPermissions(userId, context);
  if (permissions.some((permission) => current.has(permission))) {
    return;
  }
  throw new ApiError(403, "You do not have permission to perform this action");
}

export function getUserHighestRole(userId: string): { id: string; name: string; priority: number } | null {
  const row = db
    .select({ id: roles.id, name: roles.name, priority: roles.priority })
    .from(userRoleAssignments)
    .innerJoin(roles, eq(userRoleAssignments.roleId, roles.id))
    .where(eq(userRoleAssignments.userId, userId))
    .orderBy(desc(roles.priority))
    .limit(1)
    .get();

  return row ?? null;
}

export function assertRoleHierarchy(actorId: string, rolePriority: number): void {
  const highest = getUserHighestRole(actorId);
  if (!highest || highest.priority <= rolePriority) {
    throw new ApiError(403, "You cannot manage roles at or above your own role");
  }
}
