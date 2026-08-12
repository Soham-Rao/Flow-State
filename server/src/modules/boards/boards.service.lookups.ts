import { and, eq, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { attachments, boards, cards, checklists, checklistItems, comments, labels, lists, users, workspaceMemberships } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";
import type { AttachmentRecord, BoardLabel, BoardMember, CardRecord, ListRecord } from "./boards.service.types.js";

export async function assertBoardExists(boardId: string): Promise<void> {
  const rows = await db.select({ id: boards.id }).from(boards).where(and(eq(boards.id, boardId), eq(boards.workspaceId, getCurrentWorkspaceId()))).limit(1);
  if (!rows[0]) {
    throw new ApiError(404, "Board not found");
  }
}

export async function getBoardRecord(boardId: string): Promise<{ id: string; name: string; archivedAt: Date | null; archiveRetentionMinutes: number }> {
  const rows = await db
    .select({
      id: boards.id,
      name: boards.name,
      archivedAt: boards.archivedAt,
      archiveRetentionMinutes: boards.archiveRetentionMinutes
    })
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.workspaceId, getCurrentWorkspaceId())))
    .limit(1);

  const board = rows[0];

  if (!board) {
    throw new ApiError(404, "Board not found");
  }

  return board;
}

export async function assertBoardNameAvailable(name: string, excludeBoardId?: string): Promise<void> {
  const rows = await db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.workspaceId, getCurrentWorkspaceId()), eq(boards.name, name)))
    .limit(1);

  const existing = rows[0];

  if (existing && existing.id !== excludeBoardId) {
    throw new ApiError(409, "Board name already exists");
  }
}

export async function assertListExists(listId: string): Promise<ListRecord> {
  const rows = await db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt
    })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1);

  const list = rows[0];

  if (!list) {
    throw new ApiError(404, "List not found");
  }

  return list;
}

export async function getListRecord(listId: string): Promise<ListRecord> {
  return assertListExists(listId);
}

export async function assertListNameAvailable(boardId: string, name: string, excludeListId?: string): Promise<void> {
  const rows = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), eq(lists.name, name), isNull(lists.archivedAt)))
    .limit(1);

  const existing = rows[0];

  if (existing && existing.id !== excludeListId) {
    throw new ApiError(409, "List name already exists");
  }
}

export async function assertCardExists(cardId: string): Promise<CardRecord> {
  const rows = await db
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
    .limit(1);

  const card = rows[0];

  if (!card) {
    throw new ApiError(404, "Card not found");
  }

  return card;
}

export async function assertLabelExists(labelId: string): Promise<BoardLabel> {
  const rows = await db
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
    .limit(1);

  const label = rows[0];

  if (!label) {
    throw new ApiError(404, "Label not found");
  }

  return label;
}

export async function assertUserExists(userId: string): Promise<BoardMember> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      bio: users.bio,
      role: workspaceMemberships.role,
      createdAt: users.createdAt
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(and(
      eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId()),
      eq(workspaceMemberships.userId, userId),
      eq(workspaceMemberships.status, "active")
    ))
    .limit(1);

  const user = rows[0];

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
}

export async function assertChecklistExists(checklistId: string): Promise<{ id: string; cardId: string }> {
  const rows = await db
    .select({ id: checklists.id, cardId: checklists.cardId })
    .from(checklists)
    .where(eq(checklists.id, checklistId))
    .limit(1);

  const checklist = rows[0];

  if (!checklist) {
    throw new ApiError(404, "Checklist not found");
  }

  return checklist;
}

export async function assertChecklistItemExists(itemId: string): Promise<{ id: string; checklistId: string }> {
  const rows = await db
    .select({ id: checklistItems.id, checklistId: checklistItems.checklistId })
    .from(checklistItems)
    .where(eq(checklistItems.id, itemId))
    .limit(1);

  const item = rows[0];

  if (!item) {
    throw new ApiError(404, "Checklist item not found");
  }

  return item;
}

export async function assertCommentExists(commentId: string): Promise<{ id: string; boardId: string; listId: string | null; cardId: string | null; authorId: string }> {
  const rows = await db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      authorId: comments.authorId
    })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  const comment = rows[0];

  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  return comment;
}

export async function getAttachmentRecordById(attachmentId: string): Promise<AttachmentRecord> {
  const rows = await db
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
    .limit(1);

  const attachment = rows[0];

  if (!attachment) {
    throw new ApiError(404, "Attachment not found");
  }

  return attachment;
}

export async function getCardBoardContext(cardId: string): Promise<{ cardId: string; boardId: string }> {
  const rows = await db
    .select({ cardId: cards.id, boardId: lists.boardId })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(eq(cards.id, cardId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Card not found");
  }

  return row;
}

export async function getChecklistBoardContext(checklistId: string): Promise<{ checklistId: string; cardId: string; boardId: string }> {
  const rows = await db
    .select({ checklistId: checklists.id, cardId: checklists.cardId, boardId: lists.boardId })
    .from(checklists)
    .innerJoin(cards, eq(checklists.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(eq(checklists.id, checklistId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Checklist not found");
  }

  return row;
}

export async function getChecklistItemBoardContext(itemId: string): Promise<{ itemId: string; checklistId: string; cardId: string; boardId: string }> {
  const rows = await db
    .select({ itemId: checklistItems.id, checklistId: checklistItems.checklistId, cardId: checklists.cardId, boardId: lists.boardId })
    .from(checklistItems)
    .innerJoin(checklists, eq(checklistItems.checklistId, checklists.id))
    .innerJoin(cards, eq(checklists.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(eq(checklistItems.id, itemId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Checklist item not found");
  }

  return row;
}

export async function getAttachmentBoardContext(attachmentId: string): Promise<{ attachmentId: string; cardId: string; boardId: string }> {
  const rows = await db
    .select({ attachmentId: attachments.id, cardId: attachments.cardId, boardId: lists.boardId })
    .from(attachments)
    .innerJoin(cards, eq(attachments.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new ApiError(404, "Attachment not found");
  }

  return row;
}

