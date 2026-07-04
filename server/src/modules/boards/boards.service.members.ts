import { and, asc, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { users, boardMembers, boardMemberPermissions } from "../../db/schema.js";
import type { BoardMember } from "./boards.service.types.js";
import { getUserPermissions } from "../../utils/permissions.js";

export async function getBoardMembers(boardId?: string): Promise<BoardMember[]> {
  let query = db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      bio: users.bio,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(users);

  if (boardId) {
    query = query
      .innerJoin(boardMembers, and(eq(boardMembers.userId, users.id), eq(boardMembers.boardId, boardId))) as any;
  }

  return query.orderBy(asc(users.createdAt));
}

export async function getBoardMembersWithOverrides(boardId: string) {
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role
    })
    .from(users)
    .innerJoin(boardMembers, eq(boardMembers.userId, users.id))
    .where(eq(boardMembers.boardId, boardId));

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
