import { asc, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { labels } from "../../db/schema.js";
import type { BoardLabel } from "./boards.service.types.js";

export function getLabelsForBoard(boardId: string): BoardLabel[] {
  return db
    .select({
      id: labels.id,
      boardId: labels.boardId,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt
    })
    .from(labels)
    .where(eq(labels.boardId, boardId))
    .orderBy(asc(labels.createdAt))
    .all();
}
