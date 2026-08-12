import { and, asc, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { users, boardMembers, boardMemberPermissions, workspaceMemberships } from "../../db/schema.js";
import type { BoardMember } from "./boards.service.types.js";
import { getUserPermissions } from "../../utils/permissions.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";

export async function getBoardMembers(boardId?: string): Promise<BoardMember[]> {
  const selection = {
    id: users.id,
    name: users.name,
    displayName: users.displayName,
    username: users.username,
    email: users.email,
    bio: users.bio,
    role: workspaceMemberships.role,
    createdAt: users.createdAt
  };
  const workspaceFilter = and(
    eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId()),
    eq(workspaceMemberships.status, "active")
  );

  if (boardId) {
    return db
    .select({
      ...selection
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .innerJoin(boardMembers, and(eq(boardMembers.userId, users.id), eq(boardMembers.boardId, boardId)))
    .where(workspaceFilter)
    .orderBy(asc(users.createdAt));
  }

  return db
    .select({ ...selection })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(workspaceFilter)
    .orderBy(asc(users.createdAt));
}

export async function getBoardMembersWithOverrides(boardId: string) {
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: workspaceMemberships.role
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .innerJoin(boardMembers, eq(boardMembers.userId, users.id))
    .where(and(
      eq(boardMembers.boardId, boardId),
      eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId()),
      eq(workspaceMemberships.status, "active")
    ));

  const results = await Promise.all(
    members.map(async (m) => {
      const overrides = await db
        .select({
          permission: boardMemberPermissions.permission,
          access: boardMemberPermissions.access
        })
        .from(boardMemberPermissions)
        .where(
          and(
            eq(boardMemberPermissions.boardId, boardId),
            eq(boardMemberPermissions.userId, m.id)
          )
        );

      const permissionsSet = await getUserPermissions(m.id, { scopeType: "board", scopeId: boardId });
      const effectivePermissions: Record<string, boolean> = {};
      for (const p of permissionsSet) {
        effectivePermissions[p] = true;
      }

      return {
        user: m,
        overrides,
        effectivePermissions
      };
    })
  );

  return results;
}
