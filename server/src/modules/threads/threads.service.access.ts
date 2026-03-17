import { and, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { threadConversations, threadMembers, users } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { assertPermission } from "../../utils/permissions.js";
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
    .select({ id: threadConversations.id, type: threadConversations.type })
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

export function assertConversationPermission(
  userId: string,
  conversationId: string,
  permission: "dm_read" | "dm_write" | "channel_read" | "channel_write"
): void {
  assertPermission(userId, permission, { scopeType: "section", scopeId: conversationId });
}
