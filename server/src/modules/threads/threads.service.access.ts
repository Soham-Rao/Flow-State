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
import { userHasPermission } from "../../utils/permissions.js";
import type { ThreadUserSummary } from "./threads.service.types.js";

export async function getUserSummary(userId: string): Promise<ThreadUserSummary | null> {
  const rows = await db
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
    .limit(1);
  return rows[0] ?? null;
}

export async function ensureUserExists(userId: string): Promise<ThreadUserSummary> {
  const user = await getUserSummary(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  return user;
}

export async function getConversation(conversationId: string): Promise<{ id: string; type: "dm" | "channel"; createdBy: string | null }> {
  const rows = await db
    .select({ id: threadConversations.id, type: threadConversations.type, createdBy: threadConversations.createdBy })
    .from(threadConversations)
    .where(eq(threadConversations.id, conversationId))
    .limit(1);
  const conversation = rows[0];
  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }
  return conversation;
}

export async function assertConversationMember(userId: string, conversationId: string): Promise<void> {
  const rows = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, conversationId), eq(threadMembers.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new ApiError(403, "You do not have access to this conversation");
  }
}

async function getConversationPermissionOverride(
  userId: string,
  conversationId: string,
  permission: RolePermission
): Promise<"allow" | "deny" | null> {
  const rows = await db
    .select({ access: threadMemberPermissions.access })
    .from(threadMemberPermissions)
    .where(and(
      eq(threadMemberPermissions.conversationId, conversationId),
      eq(threadMemberPermissions.userId, userId),
      eq(threadMemberPermissions.permission, permission)
    ))
    .limit(1);
  return rows[0]?.access ?? null;
}

export async function userHasConversationPermission(
  userId: string,
  conversationId: string,
  permission: RolePermission
): Promise<boolean> {
  const override = await getConversationPermissionOverride(userId, conversationId, permission);
  if (override === "allow") return true;
  if (override === "deny") return false;

  if (permission === "channel_read") {
    const writeOverride = await getConversationPermissionOverride(userId, conversationId, "channel_write");
    if (writeOverride === "allow") return true;
    if (writeOverride === "deny") return false;
    if (await userHasPermission(userId, "channel_write", { scopeType: "section", scopeId: conversationId })) {
      return true;
    }
  }

  return userHasPermission(userId, permission, { scopeType: "section", scopeId: conversationId });
}

export async function assertConversationPermission(
  userId: string,
  conversationId: string,
  permission: RolePermission
): Promise<void> {
  if (!await userHasConversationPermission(userId, conversationId, permission)) {
    throw new ApiError(403, "You do not have permission to perform this action");
  }
}
