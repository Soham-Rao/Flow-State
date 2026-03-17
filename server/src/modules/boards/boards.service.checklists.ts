import crypto from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { checklistItems, checklists } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  CreateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput
} from "./boards.schema.js";
import type { BoardChecklist, BoardChecklistItem } from "./boards.service.types.js";
import { assertCardExists, assertChecklistExists, assertChecklistItemExists } from "./boards.service.lookups.js";
import { getChecklistById, getChecklistItemById } from "./boards.service.checklists-data.js";

export function createChecklist(cardId: string, input: CreateChecklistInput): BoardChecklist {
  assertCardExists(cardId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${checklists.position}), -1)` })
    .from(checklists)
    .where(eq(checklists.cardId, cardId))
    .get();

  const now = new Date();
  const checklistId = crypto.randomUUID();

  db.insert(checklists)
    .values({
      id: checklistId,
      cardId,
      title: input.title.trim(),
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      createdAt: now,
      updatedAt: now
    })
    .run();

  return getChecklistById(checklistId);
}

export function updateChecklist(checklistId: string, input: UpdateChecklistInput): BoardChecklist {
  assertChecklistExists(checklistId);

  const updatePayload: {
    title?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.title !== undefined) {
    updatePayload.title = input.title.trim();
  }

  db.update(checklists).set(updatePayload).where(eq(checklists.id, checklistId)).run();

  return getChecklistById(checklistId);
}

export function deleteChecklist(checklistId: string): void {
  const result = db.delete(checklists).where(eq(checklists.id, checklistId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Checklist not found");
  }
}

export function createChecklistItem(
  checklistId: string,
  input: CreateChecklistItemInput
): BoardChecklistItem {
  assertChecklistExists(checklistId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${checklistItems.position}), -1)` })
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklistId))
    .get();

  const now = new Date();
  const itemId = crypto.randomUUID();

  db.insert(checklistItems)
    .values({
      id: itemId,
      checklistId,
      title: input.title.trim(),
      isDone: false,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      createdAt: now,
      updatedAt: now
    })
    .run();

  return getChecklistItemById(itemId);
}

export function updateChecklistItem(itemId: string, input: UpdateChecklistItemInput): BoardChecklistItem {
  assertChecklistItemExists(itemId);

  const updatePayload: {
    title?: string;
    isDone?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.title !== undefined) {
    updatePayload.title = input.title.trim();
  }

  if (input.isDone !== undefined) {
    updatePayload.isDone = input.isDone;
  }

  db.update(checklistItems).set(updatePayload).where(eq(checklistItems.id, itemId)).run();

  return getChecklistItemById(itemId);
}

export function deleteChecklistItem(itemId: string): void {
  const result = db.delete(checklistItems).where(eq(checklistItems.id, itemId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Checklist item not found");
  }
}
