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

async function getCardListContext(cardId: string): Promise<{ card: Awaited<ReturnType<typeof getCardById>>; list: Awaited<ReturnType<typeof getListRecord>> }> {
  const card = await getCardById(cardId);
  const list = await getListRecord(card.listId);
  return { card, list };
}

export async function createChecklist(cardId: string, input: CreateChecklistInput, userId: string): Promise<BoardChecklist> {
  await assertCardExists(cardId);

  const maxPositionRows = await db
    .select({ maxPosition: sql<number>`coalesce(max(${checklists.position}), -1)` })
    .from(checklists)
    .where(eq(checklists.cardId, cardId))
    .limit(1);

  const now = new Date();
  const checklistId = crypto.randomUUID();

  await db.insert(checklists)
    .values({
      id: checklistId,
      cardId,
      title: input.title.trim(),
      position: (maxPositionRows[0]?.maxPosition ?? -1) + 1,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  const checklist = await getChecklistById(checklistId);
  const { card, list } = await getCardListContext(cardId);

  await recordActivity({
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

export async function updateChecklist(checklistId: string, input: UpdateChecklistInput, userId: string): Promise<BoardChecklist> {
  const existing = await getChecklistById(checklistId);
  await assertChecklistExists(checklistId);

  const updatePayload: {
    title?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.title !== undefined) {
    updatePayload.title = input.title.trim();
  }

  await db.update(checklists).set(updatePayload).where(eq(checklists.id, checklistId)).execute();

  const updated = await getChecklistById(checklistId);
  const { card, list } = await getCardListContext(updated.cardId);

  if (input.title !== undefined && input.title.trim() !== existing.title) {
    await recordActivity({
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

export async function deleteChecklist(checklistId: string, userId: string): Promise<void> {
  const existing = await getChecklistById(checklistId);
  const { card, list } = await getCardListContext(existing.cardId);

  const [result] = await db.delete(checklists).where(eq(checklists.id, checklistId)).execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Checklist not found");
  }

  await recordActivity({
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

export async function createChecklistItem(
  checklistId: string,
  input: CreateChecklistItemInput,
  userId: string
): Promise<BoardChecklistItem> {
  const checklist = await getChecklistById(checklistId);

  const maxPositionRows = await db
    .select({ maxPosition: sql<number>`coalesce(max(${checklistItems.position}), -1)` })
    .from(checklistItems)
    .where(eq(checklistItems.checklistId, checklistId))
    .limit(1);

  const now = new Date();
  const itemId = crypto.randomUUID();

  await db.insert(checklistItems)
    .values({
      id: itemId,
      checklistId,
      title: input.title.trim(),
      isDone: false,
      position: (maxPositionRows[0]?.maxPosition ?? -1) + 1,
      createdAt: now,
      updatedAt: now
    })
    .execute();

  const item = await getChecklistItemById(itemId);
  const { card, list } = await getCardListContext(checklist.cardId);

  await recordActivity({
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

export async function updateChecklistItem(itemId: string, input: UpdateChecklistItemInput, userId: string): Promise<BoardChecklistItem> {
  const existing = await getChecklistItemById(itemId);
  const checklist = await getChecklistById(existing.checklistId);
  await assertChecklistItemExists(itemId);

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

  await db.update(checklistItems).set(updatePayload).where(eq(checklistItems.id, itemId)).execute();

  const updated = await getChecklistItemById(itemId);
  const { card, list } = await getCardListContext(checklist.cardId);

  if (input.isDone !== undefined && input.isDone !== existing.isDone) {
    await recordActivity({
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
    await recordActivity({
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

export async function deleteChecklistItem(itemId: string, userId: string): Promise<void> {
  const existing = await getChecklistItemById(itemId);
  const checklist = await getChecklistById(existing.checklistId);
  const { card, list } = await getCardListContext(checklist.cardId);

  const [result] = await db.delete(checklistItems).where(eq(checklistItems.id, itemId)).execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Checklist item not found");
  }

  await recordActivity({
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

