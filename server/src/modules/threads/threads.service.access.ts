import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  threadConversations,
  threadMemberPermissions,
  threadMembers,
  users,
  type RolePermission
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertPermission, userHasPermission } from "../../utils/permissions.js";
import type { ThreadUserSummary } from "./threads.service.types.js";

export function getUserSummary(userId: string): ThreadUserSummary | null {
  const row = db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row ?? null;
}

export function ensureUserExists(userId: string): ThreadUserSummary {
  const user = getUserSummary(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
}

export function getConversation(conversationId: string) {
  const conversation = db
    .select({ id: threadConversations.id, type: threadConversations.type, createdBy: threadConversations.createdBy })
    .from(threadConversations)
    .where(eq(threadConversations.id, conversationId))
    .get();
  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }
  return conversation;
}

export function assertConversationMember(userId: string, conversationId: string): void {
  const membership = db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .get();
  if (!membership) {
    throw new ApiError(403, "You do not have access to this conversation");
  }
}

function getConversationPermissionOverride(
  userId: string,
  conversationId: string,
  permission: RolePermission
): "allow" | "deny" | null {
  const row = db
    .select({ access: threadMemberPermissions.access })
    .from(threadMemberPermissions)
    .where(and(
      eq(threadMemberPermissions.conversationId, conversationId),
      eq(threadMemberPermissions.userId, userId),
      eq(threadMemberPermissions.permission, permission)
    ))
    .get();
  return row?.access ?? null;
}

export function userHasConversationPermission(
  userId: string,
  conversationId: string,
  permission: RolePermission
): boolean {
  const override = getConversationPermissionOverride(userId, conversationId, permission);
  if (override === "allow") return true;
  if (override === "deny") return false;

  if (permission === "channel_read") {
    const writeOverride = getConversationPermissionOverride(userId, conversationId, "channel_write");
    if (writeOverride === "allow") return true;
    if (writeOverride === "deny") return false;
    if (userHasPermission(userId, "channel_write", { scopeType: "section", scopeId: conversationId })) {
      return true;
    }
  }

  return userHasPermission(userId, permission, { scopeType: "section", scopeId: conversationId });
}

export function assertConversationPermission(
  userId: string,
  conversationId: string,
  permission: RolePermission
): void {
  if (!userHasConversationPermission(userId, conversationId, permission)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}
