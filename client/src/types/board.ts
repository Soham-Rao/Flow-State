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

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  background: BoardBackground;
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

export interface BoardCard {
  id: string;
  listId: string;
  title: string;
  description: string | null;
  priority: CardPriority;
  dueDate: string | null;
  position: number;
  createdBy: string;
  archivedAt: string | null;
  doneEnteredAt: string | null;
  createdAt: string;
  updatedAt: string;
  checklists: Checklist[];
}

export interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isDoneList: boolean;
  createdAt: string;
  updatedAt: string;
  cards: BoardCard[];
}

export interface BoardDetail {
  id: string;
  name: string;
  description: string | null;
  background: BoardBackground;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lists: BoardList[];
}

export interface MoveCardResult {
  sourceListId: string;
  destinationListId: string;
  sourceCards: BoardCard[];
  destinationCards: BoardCard[];
}
