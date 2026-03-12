export type BoardBackground =
  | "teal-gradient"
  | "sunset-grid"
  | "ocean-glow"
  | "slate-minimal"
  | "ember-horizon";

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

export interface BoardList {
  id: string;
  boardId: string;
  name: string;
  position: number;
  isDoneList: boolean;
  createdAt: string;
  updatedAt: string;
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
