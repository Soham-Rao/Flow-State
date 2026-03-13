import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { attachments, boards, cardAssignees, cardLabels, cards, checklists, checklistItems, labels, lists, users, type CardCoverColor, type LabelColor, type RetentionMode, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  AssignAssigneeInput,
  AssignLabelInput,
  CreateBoardInput,
  CreateCardInput,
  CreateChecklistInput,
  CreateChecklistItemInput,
  CreateLabelInput,
  CreateListInput,
  MoveCardInput,
  ReorderListsInput,
  UpdateBoardInput,
  UpdateCardInput,
  UpdateChecklistInput,
  UpdateChecklistItemInput,
  UpdateLabelInput,
  UpdateListInput
} from "./boards.schema.js";

interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  background: string;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  listCount: number;
}

interface CardRecord {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  coverColor: CardCoverColor | null;
  dueDate: Date | null;
  position: number;
  createdBy: string;
  archivedAt: Date | null;
  doneEnteredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface BoardAttachment {
  id: string;
  cardId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: Date;
}

interface BoardLabel {
  id: string;
  boardId: string;
  name: string;
  color: LabelColor;
  createdAt: Date;
  updatedAt: Date;
}

interface BoardMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}


interface AttachmentRecord extends BoardAttachment {
  storedName: string;
  storagePath: string;
}

interface BoardChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  isDone: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BoardChecklist {
  id: string;
  cardId: string;
  title: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  items: BoardChecklistItem[];
}

export interface BoardCard extends CardRecord {
  checklists: BoardChecklist[];
  attachments: BoardAttachment[];
  labels: BoardLabel[];
  assignees: BoardMember[];
}

interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isDoneList: boolean;
  createdAt: Date;
  updatedAt: Date;
  cards: BoardCard[];
}

interface BoardDetail {
  id: string;
  name: string;
  description: string | null;
  background: string;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lists: BoardList[];
  labels: BoardLabel[];
  members: BoardMember[];
}

interface ListRecord {
  id: string;
  boardId: string;
  isDoneList: boolean;
}

interface MoveCardResult {
  sourceListId: string;
  destinationListId: string;
  sourceCards: BoardCard[];
  destinationCards: BoardCard[];
}

const defaultLists = [
  { name: "To Do", isDoneList: false },
  { name: "In Progress", isDoneList: false },
  { name: "Done", isDoneList: true }
] as const;

const DEFAULT_RETENTION_MINUTES = 7 * 24 * 60;
const DEFAULT_RETENTION_MODE: RetentionMode = "card_and_attachments";
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

function normalizeOptionalDescription(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function clampIndex(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }

  return value;
}


function normalizeDueDate(value: Date | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const time = value.getTime();
  if (Number.isNaN(time) || time <= 0) return new Date();
  return value;
}

function normalizeCoverColor(value: CardCoverColor | null | undefined): CardCoverColor | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "none") return null;
  return value;
}

function clampRetentionMinutes(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return DEFAULT_RETENTION_MINUTES;
  }

  if (value < 1) {
    return 1;
  }

  return Math.min(value, 525600);
}

function buildAttachmentStoragePath(boardId: string, cardId: string, storedName: string): string {
  return path.join(boardId, cardId, storedName);
}

function resolveAttachmentPath(storagePath: string): string {
  return path.join(UPLOADS_ROOT, storagePath);
}

async function ensureAttachmentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw error;
    }
  }
}

function assertBoardExists(boardId: string): void {
  const board = db.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).limit(1).get();

  if (!board) {
    throw new ApiError(404, "Board not found");
  }
}

function assertListExists(listId: string): ListRecord {
  const list = db
    .select({ id: lists.id, boardId: lists.boardId, isDoneList: lists.isDoneList })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!list) {
    throw new ApiError(404, "List not found");
  }

  return list;
}

function assertCardExists(cardId: string): CardRecord {
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
    .where(and(eq(cards.id, cardId), isNull(cards.archivedAt)))
    .limit(1)
    .get();

  if (!card) {
    throw new ApiError(404, "Card not found");
  }

  return card as CardRecord;
}

function assertLabelExists(labelId: string): BoardLabel {
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

function assertUserExists(userId: string): BoardMember {
  const member = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .get();

  if (!member) {
    throw new ApiError(404, "User not found");
  }

  return member;
}

function getLabelsForBoard(boardId: string): BoardLabel[] {
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

function getBoardMembers(): BoardMember[] {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(users)
    .orderBy(asc(users.name))
    .all();
}

function assertChecklistExists(checklistId: string): { id: string; cardId: string } {
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

function assertChecklistItemExists(itemId: string): { id: string; checklistId: string } {
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

function getChecklistItemsForChecklists(checklistIds: string[]): Map<string, BoardChecklistItem[]> {
  if (checklistIds.length === 0) {
    return new Map();
  }

  const rows = db
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
    .orderBy(asc(checklistItems.position), asc(checklistItems.createdAt))
    .all() as BoardChecklistItem[];

  const itemsByChecklistId = new Map<string, BoardChecklistItem[]>();
  for (const item of rows) {
    const items = itemsByChecklistId.get(item.checklistId) ?? [];
    items.push(item);
    itemsByChecklistId.set(item.checklistId, items);
  }

  return itemsByChecklistId;
}

function getAttachmentsForCards(cardIds: string[]): Map<string, BoardAttachment[]> {
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


function getLabelsForCards(cardIds: string[]): Map<string, BoardLabel[]> {
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

function getAssigneesForCards(cardIds: string[]): Map<string, BoardMember[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      cardId: cardAssignees.cardId,
      id: users.id,
      name: users.name,
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
      email: row.email,
      role: row.role,
      createdAt: row.createdAt
    });
    assigneesByCardId.set(row.cardId, list);
  }

  return assigneesByCardId;
}

function getChecklistsForCards(cardIds: string[]): Map<string, BoardChecklist[]> {
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

function attachChecklistsToCards(cards: CardRecord[]): BoardCard[] {
  const cardIds = cards.map((card) => card.id);
  const checklistsByCardId = getChecklistsForCards(cardIds);
  const attachmentsByCardId = getAttachmentsForCards(cardIds);
  const labelsByCardId = getLabelsForCards(cardIds);
  const assigneesByCardId = getAssigneesForCards(cardIds);

  return cards.map((card) => ({
    ...card,
    dueDate: normalizeDueDate(card.dueDate) ?? null,
    checklists: checklistsByCardId.get(card.id) ?? [],
    attachments: attachmentsByCardId.get(card.id) ?? [],
    labels: labelsByCardId.get(card.id) ?? [],
    assignees: assigneesByCardId.get(card.id) ?? []
  }));
}

function getChecklistById(checklistId: string): BoardChecklist {
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

  const items = getChecklistItemsForChecklists([checklist.id]).get(checklist.id) ?? [];

  return {
    ...checklist,
    items
  };
}

function getChecklistItemById(itemId: string): BoardChecklistItem {
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

  return item as BoardChecklistItem;
}

function getAttachmentRecordById(attachmentId: string): AttachmentRecord {
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

  return attachment as AttachmentRecord;
}

function getCardBoardContext(cardId: string): { cardId: string; boardId: string } {
  const row = db
    .select({ cardId: cards.id, boardId: lists.boardId })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(cards.id, cardId), isNull(cards.archivedAt)))
    .limit(1)
    .get();

  if (!row) {
    throw new ApiError(404, "Card not found");
  }

  return row as { cardId: string; boardId: string };
}

async function deleteAttachmentsForCard(cardId: string): Promise<void> {
  const records = db
    .select({
      id: attachments.id,
      storagePath: attachments.storagePath
    })
    .from(attachments)
    .where(eq(attachments.cardId, cardId))
    .all() as Array<{ id: string; storagePath: string }>;

  await Promise.all(
    records.map((record) => removeFileIfExists(resolveAttachmentPath(record.storagePath)))
  );

  db.delete(attachments).where(eq(attachments.cardId, cardId)).run();
}

function getCardsForList(listId: string): BoardCard[] {
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

function getCardById(cardId: string): BoardCard {
  const card = assertCardExists(cardId);
  return attachChecklistsToCards([card])[0];
}

export function getBoards(): BoardSummary[] {
  const boardRows = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
      createdBy: boards.createdBy,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt
    })
    .from(boards)
    .orderBy(asc(boards.name))
    .all();

  const countRows = db
    .select({
      boardId: lists.boardId,
      listCount: count(lists.id)
    })
    .from(lists)
    .groupBy(lists.boardId)
    .all();

  const countsByBoardId = new Map(countRows.map((row) => [row.boardId, row.listCount]));

  return boardRows.map((row) => ({
    ...row,
    listCount: countsByBoardId.get(row.id) ?? 0
  }));
}

export function getBoardById(boardId: string): BoardDetail {
  const board = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
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

  const boardLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all();

  const boardCardRows = db
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
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as CardRecord[];

  const boardCards = attachChecklistsToCards(boardCardRows);

  const cardsByListId = new Map<string, BoardCard[]>();
  for (const card of boardCards) {
    const existing = cardsByListId.get(card.listId) ?? [];
    existing.push(card);
    cardsByListId.set(card.listId, existing);
  }

  return {
    ...board,
    lists: boardLists.map((list) => ({
      ...list,
      cards: cardsByListId.get(list.id) ?? []
    })),
    labels: getLabelsForBoard(boardId),
    members: getBoardMembers()
  };
}

export function createBoard(input: CreateBoardInput, userId: string): BoardDetail {
  const now = new Date();
  const boardId = crypto.randomUUID();
  const retentionMinutes = clampRetentionMinutes(input.retentionMinutes);
  const retentionMode = input.retentionMode ?? DEFAULT_RETENTION_MODE;

  db.transaction((tx) => {
    tx.insert(boards)
      .values({
        id: boardId,
        name: input.name.trim(),
        description: normalizeOptionalDescription(input.description),
        background: input.background,
        retentionMode,
        retentionMinutes,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      })
      .run();

    tx.insert(lists)
      .values(
        defaultLists.map((defaultList, index) => ({
          id: crypto.randomUUID(),
          boardId,
          name: defaultList.name,
          position: index,
          isDoneList: defaultList.isDoneList,
          createdAt: now,
          updatedAt: now
        }))
      )
      .run();
  });

  return getBoardById(boardId);
}

export function updateBoard(boardId: string, input: UpdateBoardInput): BoardDetail {
  assertBoardExists(boardId);

  const updatePayload: {
    name?: string;
    description?: string | null;
    background?: string;
    retentionMode?: RetentionMode;
    retentionMinutes?: number;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalDescription(input.description);
  }

  if (input.background !== undefined) {
    updatePayload.background = input.background;
  }

  if (input.retentionMode !== undefined) {
    updatePayload.retentionMode = input.retentionMode;
  }

  if (input.retentionMinutes !== undefined) {
    updatePayload.retentionMinutes = clampRetentionMinutes(input.retentionMinutes);
  }

  db.update(boards).set(updatePayload).where(eq(boards.id, boardId)).run();

  return getBoardById(boardId);
}

export function deleteBoard(boardId: string): void {
  const result = db.delete(boards).where(eq(boards.id, boardId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Board not found");
  }
}


export function createLabel(boardId: string, input: CreateLabelInput): BoardLabel {
  assertBoardExists(boardId);

  const now = new Date();
  const labelId = crypto.randomUUID();

  db.insert(labels)
    .values({
      id: labelId,
      boardId,
      name: input.name.trim(),
      color: input.color,
      createdAt: now,
      updatedAt: now
    })
    .run();

  return assertLabelExists(labelId);
}

export function updateLabel(labelId: string, input: UpdateLabelInput): BoardLabel {
  assertLabelExists(labelId);

  const updatePayload: { name?: string; color?: LabelColor; updatedAt: Date } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.color !== undefined) {
    updatePayload.color = input.color;
  }

  db.update(labels).set(updatePayload).where(eq(labels.id, labelId)).run();

  return assertLabelExists(labelId);
}

export function deleteLabel(labelId: string): void {
  const result = db.delete(labels).where(eq(labels.id, labelId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Label not found");
  }
}

export function assignLabelToCard(cardId: string, input: AssignLabelInput): BoardCard {
  assertCardExists(cardId);
  const label = assertLabelExists(input.labelId);
  const { boardId } = getCardBoardContext(cardId);

  if (label.boardId !== boardId) {
    throw new ApiError(400, "Label does not belong to this board");
  }

  const existing = db
    .select({ cardId: cardLabels.cardId })
    .from(cardLabels)
    .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, input.labelId)))
    .limit(1)
    .get();

  if (!existing) {
    db.insert(cardLabels)
      .values({
        cardId,
        labelId: input.labelId,
        createdAt: new Date()
      })
      .run();
  }

  return getCardById(cardId);
}

export function removeLabelFromCard(cardId: string, labelId: string): BoardCard {
  assertCardExists(cardId);
  const result = db
    .delete(cardLabels)
    .where(and(eq(cardLabels.cardId, cardId), eq(cardLabels.labelId, labelId)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(404, "Label assignment not found");
  }

  return getCardById(cardId);
}

export function assignMemberToCard(cardId: string, input: AssignAssigneeInput): BoardCard {
  assertCardExists(cardId);
  assertUserExists(input.userId);

  const existing = db
    .select({ cardId: cardAssignees.cardId })
    .from(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, input.userId)))
    .limit(1)
    .get();

  if (!existing) {
    db.insert(cardAssignees)
      .values({
        cardId,
        userId: input.userId,
        createdAt: new Date()
      })
      .run();
  }

  return getCardById(cardId);
}

export function removeMemberFromCard(cardId: string, userId: string): BoardCard {
  assertCardExists(cardId);
  const result = db
    .delete(cardAssignees)
    .where(and(eq(cardAssignees.cardId, cardId), eq(cardAssignees.userId, userId)))
    .run();

  if (result.changes === 0) {
    throw new ApiError(404, "Assignee not found");
  }

  return getCardById(cardId);
}

export function createList(boardId: string, input: CreateListInput): BoardList {
  assertBoardExists(boardId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${lists.position}), -1)` })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .get();

  const now = new Date();
  const listId = crypto.randomUUID();

  db.insert(lists)
    .values({
      id: listId,
      boardId,
      name: input.name.trim(),
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      isDoneList: input.isDoneList,
      createdAt: now,
      updatedAt: now
    })
    .run();

  const created = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!created) {
    throw new ApiError(500, "Failed to create list");
  }

  return {
    ...created,
    cards: []
  };
}

export function updateList(listId: string, input: UpdateListInput): BoardList {
  const existing = assertListExists(listId);

  const updatePayload: {
    name?: string;
    isDoneList?: boolean;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.isDoneList !== undefined) {
    updatePayload.isDoneList = input.isDoneList;
  }

  db.update(lists)
    .set(updatePayload)
    .where(and(eq(lists.id, listId), eq(lists.boardId, existing.boardId)))
    .run();

  if (input.isDoneList !== undefined && input.isDoneList !== existing.isDoneList) {
    const now = new Date();
    if (input.isDoneList) {
      db.update(cards)
        .set({ doneEnteredAt: now, updatedAt: now })
        .where(and(eq(cards.listId, listId), isNull(cards.archivedAt), isNull(cards.doneEnteredAt)))
        .run();
    } else {
      db.update(cards)
        .set({ doneEnteredAt: null, updatedAt: now })
        .where(and(eq(cards.listId, listId), isNull(cards.archivedAt), isNotNull(cards.doneEnteredAt)))
        .run();
    }
  }

  const updated = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.id, listId))
    .limit(1)
    .get();

  if (!updated) {
    throw new ApiError(404, "List not found");
  }

  return {
    ...updated,
    cards: getCardsForList(updated.id)
  };
}

export function deleteList(listId: string): void {
  const result = db.delete(lists).where(eq(lists.id, listId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "List not found");
  }
}

export function reorderLists(boardId: string, input: ReorderListsInput): BoardList[] {
  assertBoardExists(boardId);

  const existing = db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .all();

  const existingIds = existing.map((row) => row.id);

  if (existingIds.length !== input.listIds.length) {
    throw new ApiError(400, "Reorder payload must include every list in the board");
  }

  const existingSet = new Set(existingIds);
  const invalid = input.listIds.some((id) => !existingSet.has(id));

  if (invalid) {
    throw new ApiError(400, "Reorder payload includes invalid list ids");
  }

  const now = new Date();

  db.transaction((tx) => {
    input.listIds.forEach((listId, index) => {
      tx.update(lists)
        .set({ position: index, updatedAt: now })
        .where(and(eq(lists.id, listId), eq(lists.boardId, boardId)))
        .run();
    });
  });

  return db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(eq(lists.boardId, boardId))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all()
    .map((list) => ({
      ...list,
      cards: getCardsForList(list.id)
    }));
}

export function createCard(listId: string, input: CreateCardInput, userId: string): BoardCard {
  const list = assertListExists(listId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
    .from(cards)
    .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
    .get();

  const now = new Date();
  const cardId = crypto.randomUUID();

  db.insert(cards)
    .values({
      id: cardId,
      listId: list.id,
      title: input.title.trim(),
      description: normalizeOptionalDescription(input.description),
      priority: input.priority,
      coverColor: normalizeCoverColor(input.coverColor) ?? null,
      dueDate: normalizeDueDate(input.dueDate) ?? null,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      createdBy: userId,
      doneEnteredAt: list.isDoneList ? now : null,
      createdAt: now,
      updatedAt: now
    })
    .run();

  return getCardById(cardId);
}

export function updateCard(cardId: string, input: UpdateCardInput): BoardCard {
  assertCardExists(cardId);

  const updatePayload: {
    title?: string;
    description?: string | null;
    priority?: "low" | "medium" | "high" | "urgent";
    coverColor?: CardCoverColor | null;
    dueDate?: Date | null;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.title !== undefined) {
    updatePayload.title = input.title.trim();
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalDescription(input.description);
  }

  if (input.priority !== undefined) {
    updatePayload.priority = input.priority;
  }

  if (input.coverColor !== undefined) {
    updatePayload.coverColor = normalizeCoverColor(input.coverColor) ?? null;
  }

  if (input.dueDate !== undefined) {
    updatePayload.dueDate = normalizeDueDate(input.dueDate) ?? null;
  }

  db.update(cards).set(updatePayload).where(eq(cards.id, cardId)).run();

  return getCardById(cardId);
}


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

export async function createAttachments(
  cardId: string,
  files: Express.Multer.File[]
): Promise<BoardAttachment[]> {
  assertCardExists(cardId);

  if (!files || files.length === 0) {
    throw new ApiError(400, "No attachments provided");
  }

  const { boardId } = getCardBoardContext(cardId);
  const now = new Date();
  const created: BoardAttachment[] = [];

  for (const file of files) {
    const attachmentId = crypto.randomUUID();
    const originalName = path.basename(file.originalname || "attachment");
    const extension = path.extname(originalName);
    const storedName = `${attachmentId}${extension}`;
    const storagePath = buildAttachmentStoragePath(boardId, cardId, storedName);
    const absolutePath = resolveAttachmentPath(storagePath);

    await ensureAttachmentDirectory(absolutePath);
    await fs.writeFile(absolutePath, file.buffer);

    db.insert(attachments)
      .values({
        id: attachmentId,
        cardId,
        originalName,
        storedName,
        mimeType: file.mimetype ?? null,
        size: file.size ?? 0,
        storagePath,
        createdAt: now
      })
      .run();

    created.push({
      id: attachmentId,
      cardId,
      originalName,
      mimeType: file.mimetype ?? null,
      size: file.size ?? 0,
      createdAt: now
    });
  }

  return created;
}

export function getAttachmentDownloadInfo(attachmentId: string): { filePath: string; originalName: string } {
  const attachment = getAttachmentRecordById(attachmentId);
  return {
    filePath: resolveAttachmentPath(attachment.storagePath),
    originalName: attachment.originalName
  };
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const attachment = getAttachmentRecordById(attachmentId);
  await removeFileIfExists(resolveAttachmentPath(attachment.storagePath));

  const result = db.delete(attachments).where(eq(attachments.id, attachmentId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Attachment not found");
  }
}

export async function deleteCard(cardId: string, requesterUserId: string, requesterRole: UserRole): Promise<void> {
  const existing = assertCardExists(cardId);

  if (requesterRole !== "admin" && existing.createdBy !== requesterUserId) {
    throw new ApiError(403, "You can only delete cards you created");
  }

  await deleteAttachmentsForCard(cardId);

  const result = db.delete(cards).where(eq(cards.id, cardId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Card not found");
  }
}

export function moveCard(input: MoveCardInput): MoveCardResult {
  const sourceList = assertListExists(input.sourceListId);
  const destinationList = assertListExists(input.destinationListId);

  if (sourceList.boardId !== destinationList.boardId) {
    throw new ApiError(400, "Source and destination lists must belong to the same board");
  }

  const movingCard = getCardById(input.cardId);

  if (movingCard.listId !== sourceList.id) {
    throw new ApiError(400, "Card does not belong to the provided source list");
  }

  const now = new Date();
  const sourceCards = getCardsForList(sourceList.id);

  if (!sourceCards.some((card) => card.id === movingCard.id)) {
    throw new ApiError(400, "Card does not belong to the source list");
  }

  if (sourceList.id === destinationList.id) {
    const fromIndex = sourceCards.findIndex((card) => card.id === movingCard.id);
    const toIndex = clampIndex(input.destinationIndex, 0, sourceCards.length - 1);

    const reordered = [...sourceCards];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);

    db.transaction((tx) => {
      reordered.forEach((card, index) => {
        tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
      });
    });

    const updated = getCardsForList(sourceList.id);

    return {
      sourceListId: sourceList.id,
      destinationListId: destinationList.id,
      sourceCards: updated,
      destinationCards: updated
    };
  }

  const sourceWithoutCard = sourceCards.filter((card) => card.id !== movingCard.id);
  const destinationCards = getCardsForList(destinationList.id);
  const destinationNext = [...destinationCards];

  const insertIndex = clampIndex(input.destinationIndex, 0, destinationNext.length);

  let nextDoneEnteredAt = movingCard.doneEnteredAt;
  if (!sourceList.isDoneList && destinationList.isDoneList) {
    nextDoneEnteredAt = now;
  } else if (sourceList.isDoneList && !destinationList.isDoneList) {
    nextDoneEnteredAt = null;
  }

  destinationNext.splice(insertIndex, 0, {
    ...movingCard,
    listId: destinationList.id,
    doneEnteredAt: nextDoneEnteredAt,
    updatedAt: now
  });

  db.transaction((tx) => {
    sourceWithoutCard.forEach((card, index) => {
      tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
    });

    destinationNext.forEach((card, index) => {
      if (card.id === movingCard.id) {
        tx.update(cards)
          .set({
            listId: destinationList.id,
            position: index,
            doneEnteredAt: nextDoneEnteredAt,
            updatedAt: now
          })
          .where(eq(cards.id, card.id))
          .run();
      } else {
        tx.update(cards).set({ position: index, updatedAt: now }).where(eq(cards.id, card.id)).run();
      }
    });
  });

  return {
    sourceListId: sourceList.id,
    destinationListId: destinationList.id,
    sourceCards: getCardsForList(sourceList.id),
    destinationCards: getCardsForList(destinationList.id)
  };
}
export async function cleanupExpiredCards(now: Date = new Date()): Promise<void> {
  const rows = db
    .select({
      cardId: cards.id,
      doneEnteredAt: cards.doneEnteredAt,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(isNull(cards.archivedAt), isNotNull(cards.doneEnteredAt)))
    .all() as Array<{
      cardId: string;
      doneEnteredAt: Date | null;
      retentionMode: RetentionMode | null;
      retentionMinutes: number | null;
    }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.doneEnteredAt) continue;
    const retentionMinutes = clampRetentionMinutes(row.retentionMinutes ?? DEFAULT_RETENTION_MINUTES);
    const expiresAt = row.doneEnteredAt.getTime() + retentionMinutes * 60 * 1000;
    if (nowMs < expiresAt) continue;

    const mode = row.retentionMode ?? DEFAULT_RETENTION_MODE;
    if (mode === "attachments_only") {
      await deleteAttachmentsForCard(row.cardId);
      continue;
    }

    await deleteAttachmentsForCard(row.cardId);
    db.delete(cards).where(eq(cards.id, row.cardId)).run();
  }
}


