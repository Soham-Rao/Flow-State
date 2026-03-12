export type BoardBackground =
  | "teal-gradient"
  | "ocean-glow"
  | "slate-minimal"
  | "ember-horizon"
  | "mint-breeze"
  | "rose-aurora"
  | "cobalt-dawn"
  | "sunset-grid";

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
