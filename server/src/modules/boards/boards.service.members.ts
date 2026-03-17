import { asc } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { users } from "../../db/schema.js";
import type { BoardMember } from "./boards.service.types.js";

export function getBoardMembers(): BoardMember[] {
  return db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(asc(users.createdAt))
    .all();
}
