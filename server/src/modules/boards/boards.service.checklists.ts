import crypto from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { checklistItems, checklists } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  CreateChecklistInput,
  CreateChecklistItemInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput
} from "./boards.schema.js";
import type { BoardChecklist, BoardChecklistItem } from "./boards.service.types.js";
import { assertCardExists, assertChecklistExists, assertChecklistItemExists, getListRecord } from "./boards.service.lookups.js";
import { getChecklistById, getChecklistItemById } from "./boards.service.checklists-data.js";
import { getCardById } from "./boards.service.cards-data.js";

function getCardListContext(cardId: string): { card: ReturnType<typeof getCardById>; list: ReturnType<typeof getListRecord> } {
  const card = getCardById(cardId);
  const list = getListRecord(card.listId);
  return { card, list };
}

export function createChecklist(cardId: string, input: CreateChecklistInput, userId: string): BoardChecklist {
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

  const checklist = getChecklistById(checklistId);
  const { card, list } = getCardListContext(cardId);

  recordActivity({
    type: "checklist.created",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    cardId: card.id,
    metadata: {
      checklistTitle: checklist.title,
      cardTitle: card.title,
      listName: list.name
    }
  });

  return checklist;
}

export function updateChecklist(checklistId: string, input: UpdateChecklistInput, userId: string): BoardChecklist {
  const existing = getChecklistById(checklistId);
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

  const updated = getChecklistById(checklistId);
  const { card, list } = getCardListContext(updated.cardId);

  if (input.title !== undefined && input.title.trim() !== existing.title) {
    recordActivity({
      type: "checklist.updated",
      actorId: userId,
      boardId: list.boardId,
      listId: list.id,
      cardId: card.id,
      metadata: {
        checklistTitle: updated.title,
        cardTitle: card.title,
        listName: list.name
      }
    });
  }

  return updated;
}

export function deleteChecklist(checklistId: string, userId: string): void {
  const existing = getChecklistById(checklistId);
  const { card, list } = getCardListContext(existing.cardId);

  const result = db.delete(checklists).where(eq(checklists.id, checklistId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Checklist not found");
  }

  recordActivity({
    type: "checklist.deleted",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    cardId: card.id,
    metadata: {
      checklistTitle: existing.title,
      cardTitle: card.title,
      listName: list.name
    }
  });
}

export function createChecklistItem(
  checklistId: string,
  input: CreateChecklistItemInput,
  userId: string
): BoardChecklistItem {
  const checklist = getChecklistById(checklistId);

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

  const item = getChecklistItemById(itemId);
  const { card, list } = getCardListContext(checklist.cardId);

  recordActivity({
    type: "checklist.item.created",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    cardId: card.id,
    metadata: {
      itemTitle: item.title,
      checklistTitle: checklist.title,
      cardTitle: card.title,
      listName: list.name
    }
  });

  return item;
}

export function updateChecklistItem(itemId: string, input: UpdateChecklistItemInput, userId: string): BoardChecklistItem {
  const existing = getChecklistItemById(itemId);
  const checklist = getChecklistById(existing.checklistId);
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

  const updated = getChecklistItemById(itemId);
  const { card, list } = getCardListContext(checklist.cardId);

  if (input.isDone !== undefined && input.isDone !== existing.isDone) {
    recordActivity({
      type: input.isDone ? "checklist.item.completed" : "checklist.item.uncompleted",
      actorId: userId,
      boardId: list.boardId,
      listId: list.id,
      cardId: card.id,
      metadata: {
        itemTitle: updated.title,
        checklistTitle: checklist.title,
        cardTitle: card.title,
        listName: list.name
      }
    });
  } else if (input.title !== undefined && input.title.trim() !== existing.title) {
    recordActivity({
      type: "checklist.item.updated",
      actorId: userId,
      boardId: list.boardId,
      listId: list.id,
      cardId: card.id,
      metadata: {
        itemTitle: updated.title,
        checklistTitle: checklist.title,
        cardTitle: card.title,
        listName: list.name
      }
    });
  }

  return updated;
}

export function deleteChecklistItem(itemId: string, userId: string): void {
  const existing = getChecklistItemById(itemId);
  const checklist = getChecklistById(existing.checklistId);
  const { card, list } = getCardListContext(checklist.cardId);

  const result = db.delete(checklistItems).where(eq(checklistItems.id, itemId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Checklist item not found");
  }

  recordActivity({
    type: "checklist.item.deleted",
    actorId: userId,
    boardId: list.boardId,
    listId: list.id,
    cardId: card.id,
    metadata: {
      itemTitle: existing.title,
      checklistTitle: checklist.title,
      cardTitle: card.title,
      listName: list.name
    }
  });
}
