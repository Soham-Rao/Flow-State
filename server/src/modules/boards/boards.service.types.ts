import path from "node:path";

import type { CardCoverColor, LabelColor, RetentionMode, UserRole } from "../../db/schema.js";

export interface BoardSummary {
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

export interface CardRecord {
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

export interface BoardAttachment {
  id: string;
  cardId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: Date;
}

export interface BoardLabel {
  id: string;
  boardId: string;
  name: string;
  color: LabelColor;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardMember {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface CommentReaction {
  emoji: string;
  count: number;
}

export interface BoardComment {
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

export type CommentRow = {
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

export interface AttachmentRecord extends BoardAttachment {
  storedName: string;
  storagePath: string;
}

export interface BoardChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  isDone: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardChecklist {
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

export interface BoardList {
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

export interface BoardDetail {
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

export interface ArchivedListEntry {
  id: string;
  sourceListId: string;
  name: string;
  archivedAt: Date | null;
  kind: "list" | "cards";
  cards: BoardCard[];
}

export interface ListRecord {
  id: string;
  boardId: string;
  name: string;
  isDoneList: boolean;
  archivedAt: Date | null;
}

export interface MoveCardResult {
  sourceListId: string;
  destinationListId: string;
  sourceCards: BoardCard[];
  destinationCards: BoardCard[];
}

export const defaultLists = [
  { name: "To Do", isDoneList: false },
  { name: "In Progress", isDoneList: false },
  { name: "Done", isDoneList: true }
] as const;

export const DEFAULT_RETENTION_MINUTES = 7 * 24 * 60;
export const DEFAULT_RETENTION_MODE: RetentionMode = "card_and_attachments";
export const DEFAULT_ARCHIVE_RETENTION_MINUTES = 7 * 24 * 60;
export const MAX_ARCHIVE_RETENTION_MINUTES = 365 * 24 * 60;
export const BOARD_ARCHIVE_RETENTION_MINUTES = 7 * 24 * 60;
export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
