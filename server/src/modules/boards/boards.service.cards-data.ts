import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { attachments, boards, cardAssignees, cardLabels, cards, checklists, labels, lists, users } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { getChecklistItemsForChecklists } from "./boards.service.checklists-data.js";
import { getCommentsForCards } from "./boards.service.comments-data.js";
import { assertCardExists } from "./boards.service.lookups.js";
import { normalizeDueDate, removeFileIfExists, resolveAttachmentPath } from "./boards.service.utils.js";
import type { AttachmentRecord, BoardAttachment, BoardCard, BoardChecklist, BoardLabel, BoardMember, BoardSummary, CardRecord } from "./boards.service.types.js";

export function getAttachmentsForCards(cardIds: string[]): Map<string, BoardAttachment[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      id: attachments.id,
      cardId: attachments.cardId,
      originalName: attachments.originalName,
      storedName: attachments.storedName,
      mimeType: attachments.mimeType,
      size: attachments.size,
      storagePath: attachments.storagePath,
      createdAt: attachments.createdAt
    })
    .from(attachments)
    .where(inArray(attachments.cardId, cardIds))
    .orderBy(asc(attachments.createdAt))
    .all() as AttachmentRecord[];

  const attachmentsByCardId = new Map<string, BoardAttachment[]>();
  for (const attachment of rows) {
    const list = attachmentsByCardId.get(attachment.cardId) ?? [];
    list.push({
      id: attachment.id,
      cardId: attachment.cardId,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt
    });
    attachmentsByCardId.set(attachment.cardId, list);
  }

  return attachmentsByCardId;
}

export function getLabelsForCards(cardIds: string[]): Map<string, BoardLabel[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      cardId: cardLabels.cardId,
      id: labels.id,
      boardId: labels.boardId,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt
    })
    .from(cardLabels)
    .innerJoin(labels, eq(cardLabels.labelId, labels.id))
    .where(inArray(cardLabels.cardId, cardIds))
    .orderBy(asc(labels.createdAt))
    .all();

  const labelsByCardId = new Map<string, BoardLabel[]>();
  for (const row of rows) {
    const list = labelsByCardId.get(row.cardId) ?? [];
    list.push({
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      color: row.color,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
    labelsByCardId.set(row.cardId, list);
  }

  return labelsByCardId;
}

export function getAssigneesForCards(cardIds: string[]): Map<string, BoardMember[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      cardId: cardAssignees.cardId,
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(cardAssignees)
    .innerJoin(users, eq(cardAssignees.userId, users.id))
    .where(inArray(cardAssignees.cardId, cardIds))
    .orderBy(asc(users.name))
    .all();

  const assigneesByCardId = new Map<string, BoardMember[]>();
  for (const row of rows) {
    const list = assigneesByCardId.get(row.cardId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt
    });
    assigneesByCardId.set(row.cardId, list);
  }

  return assigneesByCardId;
}

export function getChecklistsForCards(cardIds: string[]): Map<string, BoardChecklist[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const checklistRows = db
    .select({
      id: checklists.id,
      cardId: checklists.cardId,
      title: checklists.title,
      position: checklists.position,
      createdAt: checklists.createdAt,
      updatedAt: checklists.updatedAt
    })
    .from(checklists)
    .where(inArray(checklists.cardId, cardIds))
    .orderBy(asc(checklists.position), asc(checklists.createdAt))
    .all() as Array<Omit<BoardChecklist, "items">>;

  if (checklistRows.length === 0) {
    return new Map();
  }

  const checklistIds = checklistRows.map((row) => row.id);
  const itemsByChecklistId = getChecklistItemsForChecklists(checklistIds);

  const checklistsByCardId = new Map<string, BoardChecklist[]>();
  for (const checklist of checklistRows) {
    const items = itemsByChecklistId.get(checklist.id) ?? [];
    const cardLists = checklistsByCardId.get(checklist.cardId) ?? [];
    cardLists.push({ ...checklist, items });
    checklistsByCardId.set(checklist.cardId, cardLists);
  }

  return checklistsByCardId;
}

export function attachChecklistsToCards(cardsData: CardRecord[]): BoardCard[] {
  const cardIds = cardsData.map((card) => card.id);
  const checklistsByCardId = getChecklistsForCards(cardIds);
  const attachmentsByCardId = getAttachmentsForCards(cardIds);
  const labelsByCardId = getLabelsForCards(cardIds);
  const assigneesByCardId = getAssigneesForCards(cardIds);
  const commentsByCardId = getCommentsForCards(cardIds);

  return cardsData.map((card) => ({
    ...card,
    dueDate: normalizeDueDate(card.dueDate) ?? null,
    checklists: checklistsByCardId.get(card.id) ?? [],
    attachments: attachmentsByCardId.get(card.id) ?? [],
    labels: labelsByCardId.get(card.id) ?? [],
    assignees: assigneesByCardId.get(card.id) ?? [],
    comments: commentsByCardId.get(card.id) ?? []
  }));
}

export async function deleteAttachmentsForCard(cardId: string): Promise<void> {
  const records = db
    .select({
      id: attachments.id,
      storagePath: attachments.storagePath
    })
    .from(attachments)
    .where(eq(attachments.cardId, cardId))
    .all() as Array<{ id: string; storagePath: string }>;

  await Promise.all(records.map((record) => removeFileIfExists(resolveAttachmentPath(record.storagePath))));

  db.delete(attachments).where(eq(attachments.cardId, cardId)).run();
}

export function getCardsForList(listId: string): BoardCard[] {
  const rows = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as CardRecord[];

  return attachChecklistsToCards(rows);
}

export function getCardsForListIncludingArchived(listId: string): BoardCard[] {
  const rows = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .where(eq(cards.listId, listId))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as CardRecord[];

  return attachChecklistsToCards(rows);
}

export function getCardById(cardId: string): BoardCard {
  const card = assertCardExists(cardId);
  return attachChecklistsToCards([card])[0];
}

export function getCardByIdIncludingArchived(cardId: string): BoardCard {
  const card = db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .limit(1)
    .get();

  if (!card) {
    throw new ApiError(404, "Card not found");
  }

  return attachChecklistsToCards([card])[0];
}

export function getBoardSummaryById(boardId: string): BoardSummary {
  const board = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
      archiveRetentionMinutes: boards.archiveRetentionMinutes,
      archivedAt: boards.archivedAt,
      createdBy: boards.createdBy,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt
    })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
    .get();

  if (!board) {
    throw new ApiError(404, "Board not found");
  }

  const listCountRow = db
    .select({ listCount: count(lists.id) })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .get();

  return {
    ...board,
    listCount: listCountRow?.listCount ?? 0
  };
}
