import { ApiError } from "./api-error.js";
import { assertPermission, getUserPermissions, type PermissionContext } from "./permissions.js";
import type { RolePermission } from "../db/schema.js";

export async function getScopedPermissions(userId: string, context?: PermissionContext): Promise<Set<RolePermission>> {
  return getUserPermissions(userId, context);
}

export async function getBoardScopedPermissions(userId: string, boardId: string): Promise<Set<RolePermission>> {
  return getUserPermissions(userId, { scopeType: "board", scopeId: boardId });
}

export async function assertBoardPermission(userId: string, permission: RolePermission, boardId: string): Promise<void> {
  await assertPermission(userId, permission, { scopeType: "board", scopeId: boardId });
}

export function assertOwnOrAnyAccess(input: {
  actorId: string;
  ownerId: string;
  canOwn: boolean;
  canAny: boolean;
  ownMessage: string;
}): void {
  const allowed = input.canAny || (input.canOwn && input.actorId === input.ownerId);
  if (!allowed) {
    throw new ApiError(403, input.ownMessage);
  }
}

export async function assertWorkspaceManager(userId: string): Promise<void> {
  await assertPermission(userId, "manage_workspace");
}
