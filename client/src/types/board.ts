export type BoardBackground =
  | "teal-gradient"
  | "ocean-glow"
  | "slate-minimal"
  | "ember-horizon"
  | "mint-breeze"
  | "rose-aurora"
  | "cobalt-dawn"
  | "sunset-grid";

export type CardPriority = "low" | "medium" | "high" | "urgent";
export type RetentionMode = "attachments_only" | "card_and_attachments";
export type LabelColor =
  | "slate"
  | "blue"
  | "teal"
  | "green"
  | "amber"
  | "orange"
  | "red"
  | "purple"
  | "pink";

export type CardCoverColor =
  | "none"
  | "slate"
  | "blue"
  | "teal"
  | "green"
  | "amber"
  | "orange"
  | "red"
  | "purple"
  | "pink";


export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  background: BoardBackground;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  archiveRetentionMinutes: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  listCount: number;
}


export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  isDone: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  cardId: string;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  items: ChecklistItem[];
}

export interface BoardAttachment {
  id: string;
  cardId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;

}

export interface BoardLabel {
  id: string;
  boardId: string;
  name: string;
  color: LabelColor;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  createdAt: string;
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
  createdAt: string;
  updatedAt: string;
  reactions: CommentReaction[];
  mentions: BoardMember[];
}

export interface BoardCard {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priority: CardPriority;
  coverColor: CardCoverColor | null;
  dueDate: string | null;
  position: number;
  createdBy: string;
  archivedAt: string | null;
  doneEnteredAt: string | null;
  createdAt: string;
  updatedAt: string;
  checklists: Checklist[];
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
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cards: BoardCard[];
  comments: BoardComment[];
}

export interface BoardDetail {
  id: string;
  name: string;
  description: string | null;
  background: BoardBackground;
  retentionMode: RetentionMode;
  retentionMinutes: number;
  archiveRetentionMinutes: number;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lists: BoardList[];
  labels: BoardLabel[];
  members: BoardMember[];
  comments: BoardComment[];
}

export interface MoveCardResult {
  sourceListId: string;
  destinationListId: string;
  sourceCards: BoardCard[];
  destinationCards: BoardCard[];
}

export interface ArchivedListEntry {
  id: string;
  sourceListId: string;
  name: string;
  archivedAt: string | null;
  kind: "list" | "cards";
  cards: BoardCard[];
}
