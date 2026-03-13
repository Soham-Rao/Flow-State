import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { and, asc, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { attachments, boards, cardAssignees, cardLabels, cards, checklistItems, checklists, commentMentions, commentReactions, comments, labels, lists, users, type CardCoverColor, type LabelColor, type RetentionMode, type UserRole } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import type {
  AssignAssigneeInput,
  AssignLabelInput,
  CommentReactionInput,
  CreateBoardInput,
  CreateCardInput,
  CreateChecklistInput,
  CreateChecklistItemInput,
  CreateCommentInput,
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
  archiveRetentionMinutes: number;
  archivedAt: Date | null;
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
  displayName: string | null;
  username: string | null;
  email: string;
  role: UserRole;
  createdAt: Date;
}


interface CommentReaction {
  emoji: string;
  count: number;
}

interface BoardComment {
  id: string;
  boardId: string;
  listId: string | null;
  cardId: string | null;
  author: BoardMember;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  reactions: CommentReaction[];
  mentions: BoardMember[];
}

type CommentRow = {
  id: string;
  boardId: string;
  listId: string | null;
  cardId: string | null;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  authorName: string;
  authorDisplayName: string | null;
  authorUsername: string | null;
  authorEmail: string;
  authorRole: UserRole;
  authorCreatedAt: Date;
};

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
  comments: BoardComment[];
}

interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isDoneList: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cards: BoardCard[];
  comments: BoardComment[];
}

interface BoardDetail {
  id: string;
  name: string;
  description: string | null;
  background: string;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  archiveRetentionMinutes: number;
  archivedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lists: BoardList[];
  labels: BoardLabel[];
  members: BoardMember[];
  comments: BoardComment[];
}

interface ArchivedListEntry {
  id: string;
  sourceListId: string;
  name: string;
  archivedAt: Date | null;
  kind: "list" | "cards";
  cards: BoardCard[];
}

interface ListRecord {
  id: string;
  boardId: string;
  name: string;
  isDoneList: boolean;
  archivedAt: Date | null;
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
const DEFAULT_ARCHIVE_RETENTION_MINUTES = 7 * 24 * 60;
const MAX_ARCHIVE_RETENTION_MINUTES = 365 * 24 * 60;
const BOARD_ARCHIVE_RETENTION_MINUTES = 7 * 24 * 60;
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

function resolveRestoredName(name: string, existing: Set<string>): string {
  let candidate = `${name} - restored`;
  while (existing.has(candidate)) {
    candidate = `${candidate} - restored`;
  }
  return candidate;
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

function clampArchiveRetentionMinutes(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) {
    return DEFAULT_ARCHIVE_RETENTION_MINUTES;
  }

  if (value < 1) {
    return 1;
  }

  return Math.min(value, MAX_ARCHIVE_RETENTION_MINUTES);
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
  const board = db
    .select({ id: boards.id })
    .from(boards)
    .where(and(eq(boards.id, boardId), isNull(boards.archivedAt)))
    .limit(1)
    .get();

  if (!board) {
    throw new ApiError(404, "Board not found");
  }
}

function getBoardRecord(boardId: string): { id: string; name: string; archivedAt: Date | null; archiveRetentionMinutes: number } {
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

function assertBoardNameAvailable(name: string, excludeBoardId?: string): void {
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

function assertListExists(listId: string): ListRecord {
  const list = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt
    })
    .from(lists)
    .where(and(eq(lists.id, listId), isNull(lists.archivedAt)))
    .limit(1)
    .get();

  if (!list) {
    throw new ApiError(404, "List not found");
  }

  return list;
}

function getListRecord(listId: string): ListRecord {
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

function assertListNameAvailable(boardId: string, name: string, excludeListId?: string): void {
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
      displayName: users.displayName,
      username: users.username,
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

function assertCommentExists(commentId: string): { id: string; boardId: string; listId: string | null; cardId: string | null; authorId: string } {
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

function getCommentReactionsForComments(commentIds: string[]): Map<string, CommentReaction[]> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      commentId: commentReactions.commentId,
      emoji: commentReactions.emoji
    })
    .from(commentReactions)
    .where(inArray(commentReactions.commentId, commentIds))
    .all() as Array<{ commentId: string; emoji: string }>;

  const countsByCommentId = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const emojiCounts = countsByCommentId.get(row.commentId) ?? new Map<string, number>();
    emojiCounts.set(row.emoji, (emojiCounts.get(row.emoji) ?? 0) + 1);
    countsByCommentId.set(row.commentId, emojiCounts);
  }

  const reactionsByCommentId = new Map<string, CommentReaction[]>();
  for (const [commentId, emojiCounts] of countsByCommentId) {
    const reactions = Array.from(emojiCounts.entries()).map(([emoji, count]) => ({ emoji, count }));
    reactionsByCommentId.set(commentId, reactions);
  }

  return reactionsByCommentId;
}

function getCommentMentionsForComments(commentIds: string[]): Map<string, BoardMember[]> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      commentId: commentMentions.commentId,
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt
    })
    .from(commentMentions)
    .innerJoin(users, eq(commentMentions.userId, users.id))
    .where(inArray(commentMentions.commentId, commentIds))
    .all();

  const mentionsByCommentId = new Map<string, BoardMember[]>();
  for (const row of rows) {
    const list = mentionsByCommentId.get(row.commentId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      role: row.role,
      createdAt: row.createdAt
    });
    mentionsByCommentId.set(row.commentId, list);
  }

  return mentionsByCommentId;
}

function attachCommentRelations(rows: CommentRow[]): BoardComment[] {
  const commentIds = rows.map((row) => row.id);
  const reactionsByCommentId = getCommentReactionsForComments(commentIds);
  const mentionsByCommentId = getCommentMentionsForComments(commentIds);

  return rows.map((row) => ({
    id: row.id,
    boardId: row.boardId,
    listId: row.listId ?? null,
    cardId: row.cardId ?? null,
    author: {
      id: row.authorId,
      name: row.authorName,
      email: row.authorEmail,
      role: row.authorRole,
      createdAt: row.authorCreatedAt
    },
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reactions: reactionsByCommentId.get(row.id) ?? [],
    mentions: mentionsByCommentId.get(row.id) ?? []
  }));
}

function getCommentsForBoard(boardId: string): BoardComment[] {
  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(and(eq(comments.boardId, boardId), isNull(comments.listId), isNull(comments.cardId)))
    .orderBy(asc(comments.createdAt))
    .all() as CommentRow[];

  return attachCommentRelations(rows);
}

function getCommentsForLists(listIds: string[]): Map<string, BoardComment[]> {
  if (listIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(and(inArray(comments.listId, listIds), isNull(comments.cardId)))
    .orderBy(asc(comments.createdAt))
    .all() as CommentRow[];

  const commentsByListId = new Map<string, BoardComment[]>();
  for (const comment of attachCommentRelations(rows)) {
    if (!comment.listId) continue;
    const list = commentsByListId.get(comment.listId) ?? [];
    list.push(comment);
    commentsByListId.set(comment.listId, list);
  }

  return commentsByListId;
}

function getCommentsForCards(cardIds: string[]): Map<string, BoardComment[]> {
  if (cardIds.length === 0) {
    return new Map();
  }

  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(inArray(comments.cardId, cardIds))
    .orderBy(asc(comments.createdAt))
    .all() as CommentRow[];

  const commentsByCardId = new Map<string, BoardComment[]>();
  for (const comment of attachCommentRelations(rows)) {
    if (!comment.cardId) continue;
    const list = commentsByCardId.get(comment.cardId) ?? [];
    list.push(comment);
    commentsByCardId.set(comment.cardId, list);
  }

  return commentsByCardId;
}

function getCommentById(commentId: string): BoardComment {
  const rows = db
    .select({
      id: comments.id,
      boardId: comments.boardId,
      listId: comments.listId,
      cardId: comments.cardId,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      authorId: users.id,
      authorName: users.name,
      authorDisplayName: users.displayName,
      authorUsername: users.username,
      authorEmail: users.email,
      authorRole: users.role,
      authorCreatedAt: users.createdAt
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.id, commentId))
    .limit(1)
    .all() as CommentRow[];

  if (rows.length === 0) {
    throw new ApiError(404, "Comment not found");
  }

  return attachCommentRelations(rows)[0];
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
  const commentsByCardId = getCommentsForCards(cardIds);

  return cards.map((card) => ({
    ...card,
    dueDate: normalizeDueDate(card.dueDate) ?? null,
    checklists: checklistsByCardId.get(card.id) ?? [],
    attachments: attachmentsByCardId.get(card.id) ?? [],
    labels: labelsByCardId.get(card.id) ?? [],
    assignees: assigneesByCardId.get(card.id) ?? [],
    comments: commentsByCardId.get(card.id) ?? []
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

function getCardsForListIncludingArchived(listId: string): BoardCard[] {
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

function getCardById(cardId: string): BoardCard {
  const card = assertCardExists(cardId);
  return attachChecklistsToCards([card])[0];
}

function getCardByIdIncludingArchived(cardId: string): BoardCard {
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

function getBoardSummaryById(boardId: string): BoardSummary {
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

export function getBoards(): BoardSummary[] {
  const boardRows = db
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
    .orderBy(asc(boards.name))
    .all();

  const countRows = db
    .select({
      boardId: lists.boardId,
      listCount: count(lists.id)
    })
    .from(lists)
    .where(isNull(lists.archivedAt))
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

  const boardLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
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
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt))
    .all() as CardRecord[];

  const boardCards = attachChecklistsToCards(boardCardRows);

  const cardsByListId = new Map<string, BoardCard[]>();
  for (const card of boardCards) {
    const existing = cardsByListId.get(card.listId) ?? [];
    existing.push(card);
    cardsByListId.set(card.listId, existing);
  }

  const listCommentsByListId = getCommentsForLists(boardLists.map((list) => list.id));
  const boardComments = getCommentsForBoard(boardId);

  return {
    ...board,
    lists: boardLists.map((list) => ({
      ...list,
      cards: cardsByListId.get(list.id) ?? [],
      comments: listCommentsByListId.get(list.id) ?? []
    })),
    labels: getLabelsForBoard(boardId),
    members: getBoardMembers(),
    comments: boardComments
  };
}

export function getArchivedLists(boardId: string): ArchivedListEntry[] {
  assertBoardExists(boardId);

  const archivedLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      archivedAt: lists.archivedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNotNull(lists.archivedAt)))
    .orderBy(asc(lists.archivedAt), asc(lists.createdAt))
    .all();

  const archivedListEntries: ArchivedListEntry[] = archivedLists.map((list) => ({
    id: list.id,
    sourceListId: list.id,
    name: list.name,
    archivedAt: list.archivedAt,
    kind: "list",
    cards: getCardsForListIncludingArchived(list.id)
  }));

  const archivedCardRows = db
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
      updatedAt: cards.updatedAt,
      listName: lists.name
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNotNull(cards.archivedAt)))
    .orderBy(asc(cards.archivedAt), asc(cards.createdAt))
    .all() as Array<CardRecord & { listName: string }>;

  const listNameById = new Map(archivedCardRows.map((row) => [row.listId, row.listName]));
  const archivedCards = attachChecklistsToCards(archivedCardRows.map(({ listName, ...card }) => card));

  const archivedCardsByListId = new Map<string, BoardCard[]>();
  for (const card of archivedCards) {
    const list = archivedCardsByListId.get(card.listId) ?? [];
    list.push(card);
    archivedCardsByListId.set(card.listId, list);
  }

  const archivedCardEntries: ArchivedListEntry[] = Array.from(archivedCardsByListId.entries()).map(([listId, cards]) => {
    const listName = listNameById.get(listId) ?? "Archived";
    const archivedAt = cards.reduce<Date | null>((current, card) => {
      if (!card.archivedAt) return current;
      if (!current) return card.archivedAt;
      return card.archivedAt < current ? card.archivedAt : current;
    }, null);
    return {
      id: `archived-cards:${listId}`,
      sourceListId: listId,
      name: `${listName} - archived`,
      archivedAt,
      kind: "cards",
      cards
    };
  });

  return [...archivedListEntries, ...archivedCardEntries];
}

export function createBoard(input: CreateBoardInput, userId: string): BoardDetail {
  const now = new Date();
  const boardId = crypto.randomUUID();
  const trimmedName = input.name.trim();
  const retentionMinutes = clampRetentionMinutes(input.retentionMinutes);
  const retentionMode = input.retentionMode ?? DEFAULT_RETENTION_MODE;
  const archiveRetentionMinutes = clampArchiveRetentionMinutes(input.archiveRetentionMinutes);

  assertBoardNameAvailable(trimmedName);

  db.transaction((tx) => {
    tx.insert(boards)
      .values({
        id: boardId,
        name: trimmedName,
        description: normalizeOptionalDescription(input.description),
        background: input.background,
        retentionMode,
        retentionMinutes,
        archiveRetentionMinutes,
        archivedAt: null,
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
    archiveRetentionMinutes?: number;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    assertBoardNameAvailable(trimmed, boardId);
    updatePayload.name = trimmed;
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

  if (input.archiveRetentionMinutes !== undefined) {
    updatePayload.archiveRetentionMinutes = clampArchiveRetentionMinutes(input.archiveRetentionMinutes);
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

export function archiveBoard(boardId: string): BoardSummary {
  const board = getBoardRecord(boardId);
  if (board.archivedAt) {
    return getBoardSummaryById(boardId);
  }

  db.update(boards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .run();

  return getBoardSummaryById(boardId);
}

export function restoreBoard(boardId: string): BoardSummary {
  const board = getBoardRecord(boardId);
  if (!board.archivedAt) {
    return getBoardSummaryById(boardId);
  }

  db.update(boards)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .run();

  return getBoardSummaryById(boardId);
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

function storeCommentMentions(commentId: string, mentions: string[] | undefined): void {
  if (!mentions || mentions.length === 0) {
    return;
  }

  const uniqueMentions = Array.from(new Set(mentions));
  const existingUsers = db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, uniqueMentions))
    .all();

  if (existingUsers.length === 0) {
    return;
  }

  db.insert(commentMentions)
    .values(existingUsers.map((user) => ({
      commentId,
      userId: user.id,
      createdAt: new Date()
    })))
    .run();
}

function createCommentRecord(params: {
  boardId: string;
  listId: string | null;
  cardId: string | null;
  input: CreateCommentInput;
  authorId: string;
}): BoardComment {
  const now = new Date();
  const commentId = crypto.randomUUID();

  db.insert(comments)
    .values({
      id: commentId,
      boardId: params.boardId,
      listId: params.listId,
      cardId: params.cardId,
      authorId: params.authorId,
      body: params.input.body.trim(),
      createdAt: now,
      updatedAt: now
    })
    .run();

  storeCommentMentions(commentId, params.input.mentions);

  return getCommentById(commentId);
}

export function deleteComment(commentId: string, requesterUserId: string, requesterRole: UserRole): void {
  const comment = assertCommentExists(commentId);

  if (requesterRole !== "admin" && comment.authorId !== requesterUserId) {
    throw new ApiError(403, "You can only delete comments you created");
  }

  db.transaction((tx) => {
    tx.delete(commentMentions).where(eq(commentMentions.commentId, commentId)).run();
    tx.delete(commentReactions).where(eq(commentReactions.commentId, commentId)).run();
    tx.delete(comments).where(eq(comments.id, commentId)).run();
  });
}

export function createBoardComment(boardId: string, input: CreateCommentInput, authorId: string): BoardComment {
  assertBoardExists(boardId);

  return createCommentRecord({
    boardId,
    listId: null,
    cardId: null,
    input,
    authorId
  });
}

export function createListComment(listId: string, input: CreateCommentInput, authorId: string): BoardComment {
  const list = assertListExists(listId);

  return createCommentRecord({
    boardId: list.boardId,
    listId: list.id,
    cardId: null,
    input,
    authorId
  });
}

export function createCardComment(cardId: string, input: CreateCommentInput, authorId: string): BoardComment {
  assertCardExists(cardId);
  const { boardId } = getCardBoardContext(cardId);

  return createCommentRecord({
    boardId,
    listId: null,
    cardId,
    input,
    authorId
  });
}

export function toggleCommentReaction(commentId: string, userId: string, input: CommentReactionInput): BoardComment {
  assertCommentExists(commentId);

  const existing = db
    .select({ commentId: commentReactions.commentId })
    .from(commentReactions)
    .where(and(
      eq(commentReactions.commentId, commentId),
      eq(commentReactions.userId, userId),
      eq(commentReactions.emoji, input.emoji)
    ))
    .limit(1)
    .get();

  if (existing) {
    db.delete(commentReactions)
      .where(and(
        eq(commentReactions.commentId, commentId),
        eq(commentReactions.userId, userId),
        eq(commentReactions.emoji, input.emoji)
      ))
      .run();
  } else {
    db.insert(commentReactions)
      .values({
        commentId,
        userId,
        emoji: input.emoji,
        createdAt: new Date()
      })
      .run();
  }

  return getCommentById(commentId);
}


export function createList(boardId: string, input: CreateListInput): BoardList {
  assertBoardExists(boardId);

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${lists.position}), -1)` })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .get();

  const now = new Date();
  const listId = crypto.randomUUID();
  const trimmedName = input.name.trim();

  assertListNameAvailable(boardId, trimmedName);

  db.insert(lists)
    .values({
      id: listId,
      boardId,
      name: trimmedName,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      isDoneList: input.isDoneList,
      archivedAt: null,
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
      archivedAt: lists.archivedAt,
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
    cards: [],
    comments: []
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
      archivedAt: lists.archivedAt,
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
    cards: getCardsForList(updated.id),
    comments: getCommentsForLists([updated.id]).get(updated.id) ?? []
  };
}

export function deleteList(listId: string): void {
  const result = db.delete(lists).where(eq(lists.id, listId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "List not found");
  }
}

export function archiveList(listId: string): void {
  const list = assertListExists(listId);
  if (list.archivedAt) return;

  db.update(lists)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(lists.id, listId))
    .run();
}

export function restoreList(listId: string, renameConflicts: boolean): BoardDetail {
  const list = getListRecord(listId);
  if (!list.archivedAt) {
    return getBoardById(list.boardId);
  }

  const existingList = db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(and(eq(lists.boardId, list.boardId), eq(lists.name, list.name), isNull(lists.archivedAt)))
    .limit(1)
    .get();

  const now = new Date();

  if (existingList) {
    const archivedCards = getCardsForListIncludingArchived(list.id);
    const existingCards = getCardsForList(existingList.id);
    const existingNames = new Set(existingCards.map((card) => card.title));

    const renameMap = new Map<string, string>();
    for (const card of archivedCards) {
      if (!existingNames.has(card.title)) {
        continue;
      }
      if (!renameConflicts) {
        throw new ApiError(409, "Card with same name exists creating conflict");
      }
      const nextName = resolveRestoredName(card.title, existingNames);
      renameMap.set(card.id, nextName);
      existingNames.add(nextName);
    }

    const maxPositionRow = db
      .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
      .from(cards)
      .where(and(eq(cards.listId, existingList.id), isNull(cards.archivedAt)))
      .get();

    let nextPosition = (maxPositionRow?.maxPosition ?? -1) + 1;

    db.transaction((tx) => {
      archivedCards.forEach((card) => {
        const nextTitle = renameMap.get(card.id) ?? card.title;
        tx.update(cards)
          .set({
            listId: existingList.id,
            title: nextTitle,
            archivedAt: null,
            position: nextPosition++,
            updatedAt: now
          })
          .where(eq(cards.id, card.id))
          .run();
      });

      tx.delete(lists).where(eq(lists.id, list.id)).run();
    });

    return getBoardById(list.boardId);
  }

  db.transaction((tx) => {
    tx.update(lists)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(lists.id, list.id))
      .run();

    tx.update(cards)
      .set({ archivedAt: null, updatedAt: now })
      .where(eq(cards.listId, list.id))
      .run();
  });

  return getBoardById(list.boardId);
}

export function reorderLists(boardId: string, input: ReorderListsInput): BoardList[] {
  assertBoardExists(boardId);

  const existing = db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
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

  const updatedLists = db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .orderBy(asc(lists.position), asc(lists.createdAt))
    .all();

  const commentsByListId = getCommentsForLists(updatedLists.map((list) => list.id));

  return updatedLists.map((list) => ({
    ...list,
    cards: getCardsForList(list.id),
    comments: commentsByListId.get(list.id) ?? []
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

export function archiveCard(cardId: string, requesterUserId: string, requesterRole: UserRole): BoardCard {
  const existing = assertCardExists(cardId);

  if (requesterRole !== "admin" && existing.createdBy !== requesterUserId) {
    throw new ApiError(403, "You can only archive cards you created");
  }

  db.update(cards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(cards.id, cardId))
    .run();

  return getCardByIdIncludingArchived(cardId);
}

export function restoreCard(cardId: string, renameConflicts: boolean): BoardCard {
  const card = getCardByIdIncludingArchived(cardId);
  if (!card.archivedAt) {
    return card;
  }

  const list = getListRecord(card.listId);
  if (list.archivedAt) {
    throw new ApiError(400, "List is archived. Restore the list first.");
  }

  const existingCards = getCardsForList(list.id);
  const existingNames = new Set(existingCards.map((item) => item.title));
  let nextTitle = card.title;

  if (existingNames.has(nextTitle)) {
    if (!renameConflicts) {
      throw new ApiError(409, "Card with same name exists creating conflict");
    }
    nextTitle = resolveRestoredName(nextTitle, existingNames);
  }

  const maxPositionRow = db
    .select({ maxPosition: sql<number>`coalesce(max(${cards.position}), -1)` })
    .from(cards)
    .where(and(eq(cards.listId, list.id), isNull(cards.archivedAt)))
    .get();

  db.update(cards)
    .set({
      archivedAt: null,
      title: nextTitle,
      position: (maxPositionRow?.maxPosition ?? -1) + 1,
      updatedAt: new Date()
    })
    .where(eq(cards.id, cardId))
    .run();

  return getCardById(cardId);
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

  await cleanupArchivedCards(now);
  await cleanupArchivedLists(now);
  await cleanupArchivedBoards(now);
}


async function cleanupArchivedCards(now: Date): Promise<void> {
  const rows = db
    .select({
      cardId: cards.id,
      archivedAt: cards.archivedAt,
      boardArchiveRetention: boards.archiveRetentionMinutes
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(isNotNull(cards.archivedAt), isNull(lists.archivedAt), isNull(boards.archivedAt)))
    .all() as Array<{
      cardId: string;
      archivedAt: Date | null;
      boardArchiveRetention: number | null;
    }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.archivedAt) continue;
    const retentionMinutes = clampArchiveRetentionMinutes(row.boardArchiveRetention ?? DEFAULT_ARCHIVE_RETENTION_MINUTES);
    const expiresAt = row.archivedAt.getTime() + retentionMinutes * 60 * 1000;
    if (nowMs < expiresAt) continue;

    await deleteAttachmentsForCard(row.cardId);
    db.delete(cards).where(eq(cards.id, row.cardId)).run();
  }
}

async function cleanupArchivedLists(now: Date): Promise<void> {
  const rows = db
    .select({
      listId: lists.id,
      archivedAt: lists.archivedAt,
      boardArchiveRetention: boards.archiveRetentionMinutes
    })
    .from(lists)
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(isNotNull(lists.archivedAt), isNull(boards.archivedAt)))
    .all() as Array<{
      listId: string;
      archivedAt: Date | null;
      boardArchiveRetention: number | null;
    }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.archivedAt) continue;
    const retentionMinutes = clampArchiveRetentionMinutes(row.boardArchiveRetention ?? DEFAULT_ARCHIVE_RETENTION_MINUTES);
    const expiresAt = row.archivedAt.getTime() + retentionMinutes * 60 * 1000;
    if (nowMs < expiresAt) continue;

    const cardRows = db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.listId, row.listId))
      .all() as Array<{ id: string }>;

    for (const card of cardRows) {
      await deleteAttachmentsForCard(card.id);
    }

    db.delete(lists).where(eq(lists.id, row.listId)).run();
  }
}

async function cleanupArchivedBoards(now: Date): Promise<void> {
  const rows = db
    .select({
      boardId: boards.id,
      archivedAt: boards.archivedAt
    })
    .from(boards)
    .where(isNotNull(boards.archivedAt))
    .all() as Array<{ boardId: string; archivedAt: Date | null }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.archivedAt) continue;
    const expiresAt = row.archivedAt.getTime() + BOARD_ARCHIVE_RETENTION_MINUTES * 60 * 1000;
    if (nowMs < expiresAt) continue;

    const cardRows = db
      .select({ id: cards.id })
      .from(cards)
      .innerJoin(lists, eq(cards.listId, lists.id))
      .where(eq(lists.boardId, row.boardId))
      .all() as Array<{ id: string }>;

    for (const card of cardRows) {
      await deleteAttachmentsForCard(card.id);
    }

    db.delete(boards).where(eq(boards.id, row.boardId)).run();
  }
}

