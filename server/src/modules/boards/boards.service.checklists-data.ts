import { asc, eq, inArray } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { checklistItems, checklists } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { BoardChecklist, BoardChecklistItem } from "./boards.service.types.js";

export function getChecklistItemsForChecklists(checklistIds: string[]): Map<string, BoardChecklistItem[]> {
  if (checklistIds.length === 0) {
    return new Map();
  }

  const items = db
    .select({
      id: checklistItems.id,
      checklistId: checklistItems.checklistId,
      title: checklistItems.title,
      isDone: checklistItems.isDone,
      position: checklistItems.position,
      createdAt: checklistItems.createdAt,
      updatedAt: checklistItems.updatedAt
    })
    .from(checklistItems)
    .where(inArray(checklistItems.checklistId, checklistIds))
    .orderBy(asc(checklistItems.position))
    .all();

  const map = new Map<string, BoardChecklistItem[]>();
  for (const item of items) {
    const list = map.get(item.checklistId) ?? [];
    list.push(item);
    map.set(item.checklistId, list);
  }

  return map;
}

export function getChecklistById(checklistId: string): BoardChecklist {
  const checklist = db
    .select({
      id: checklists.id,
      cardId: checklists.cardId,
      title: checklists.title,
      position: checklists.position,
      createdAt: checklists.createdAt,
      updatedAt: checklists.updatedAt
    })
    .from(checklists)
    .where(eq(checklists.id, checklistId))
    .limit(1)
    .get();

  if (!checklist) {
    throw new ApiError(404, "Checklist not found");
  }

  const itemsMap = getChecklistItemsForChecklists([checklistId]);
  return {
    ...checklist,
    items: itemsMap.get(checklistId) ?? []
  };
}

export function getChecklistItemById(itemId: string): BoardChecklistItem {
  const item = db
    .select({
      id: checklistItems.id,
      checklistId: checklistItems.checklistId,
      title: checklistItems.title,
      isDone: checklistItems.isDone,
      position: checklistItems.position,
      createdAt: checklistItems.createdAt,
      updatedAt: checklistItems.updatedAt
    })
    .from(checklistItems)
    .where(eq(checklistItems.id, itemId))
    .limit(1)
    .get();

  if (!item) {
    throw new ApiError(404, "Checklist item not found");
  }

  return item;
}
