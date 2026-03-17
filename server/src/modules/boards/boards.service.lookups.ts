import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { attachments, boards, cards, checklists, checklistItems, comments, labels, lists, users } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type { AttachmentRecord, BoardLabel, BoardMember, CardRecord, ListRecord } from "./boards.service.types.js";

export function assertBoardExists(boardId: string): void {
  const row = db.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).limit(1).get();
  if (!row) {
    throw new ApiError(404, "Board not found");
  }
}

export function getBoardRecord(boardId: string): { id: string; name: string; archivedAt: Date | null; archiveRetentionMinutes: number } {
  const board = db
    .select({
      id: boards.id,
      name: boards.name,
      archivedAt: boards.archivedAt,
      archiveRetentionMinutes: boards.archiveRetentionMinutes
    })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1)
    .get();

  if (!board) {
    throw new ApiError(404, "Board not found");
  }

  return board;
}

export function assertBoardNameAvailable(name: string, excludeBoardId?: string): void {
  const existing = db
    .select({ id: boards.id })
    .from(boards)
    .where(eq(boards.name, name))
    .limit(1)
    .get();

  if (existing && existing.id !== excludeBoardId) {
    throw new ApiError(409, "Board name already exists");
  }
}
export function assertListExists(listId: string): ListRecord {
  const list = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt
    })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!list) {
    throw new ApiError(404, "List not found");
  }

  return list;
}

export function getListRecord(listId: string): ListRecord {
  return assertListExists(listId);
}

export function assertListNameAvailable(boardId: string, name: string, excludeListId?: string): void {
  const existing = db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), eq(lists.name, name), isNull(lists.archivedAt)))
    .limit(1)
    .get();

  if (existing && existing.id !== excludeListId) {
    throw new ApiError(409, "List name already exists");
  }
}
export function assertCardExists(cardId: string): CardRecord {
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

  return card;
}

export function assertLabelExists(labelId: string): BoardLabel {
  const label = db
    .select({
      id: labels.id,
      boardId: labels.boardId,
      name: labels.name,
      color: labels.color,
      createdAt: labels.createdAt,
      updatedAt: labels.updatedAt
    })
    .from(labels)
    .where(eq(labels.id, labelId))
    .limit(1)
    .get();

  if (!label) {
    throw new ApiError(404, "Label not found");
  }

  return label;
}

export function assertUserExists(userId: string): BoardMember {
  const user = db
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
    .where(eq(users.id, userId))
    .limit(1)
    .get();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

export function assertChecklistExists(checklistId: string): { id: string; cardId: string } {
  const checklist = db
    .select({ id: checklists.id, cardId: checklists.cardId })
    .from(checklists)
    .where(eq(checklists.id, checklistId))
    .limit(1)
    .get();

  if (!checklist) {
    throw new ApiError(404, "Checklist not found");
  }

  return checklist;
}

export function assertChecklistItemExists(itemId: string): { id: string; checklistId: string } {
  const item = db
    .select({ id: checklistItems.id, checklistId: checklistItems.checklistId })
    .from(checklistItems)
    .where(eq(checklistItems.id, itemId))
    .limit(1)
    .get();

  if (!item) {
    throw new ApiError(404, "Checklist item not found");
  }

  return item;
}

export function assertCommentExists(commentId: string): { id: string; boardId: string; listId: string | null; cardId: string | null; authorId: string } {
  const comment = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      authorId: comments.authorId
    })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1)
    .get();

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  return comment;
}

export function getAttachmentRecordById(attachmentId: string): AttachmentRecord {
  const attachment = db
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
    .where(eq(attachments.id, attachmentId))
    .limit(1)
    .get();

  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  return attachment;
}

export function getCardBoardContext(cardId: string): { cardId: string; boardId: string } {
  const row = db
    .select({ cardId: cards.id, boardId: lists.boardId })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(eq(cards.id, cardId))
    .limit(1)
    .get();

  if (!row) {
    throw new ApiError(404, "Card not found");
  }

  return row;
}



