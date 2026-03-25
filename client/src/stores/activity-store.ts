import { create } from "zustand";

import { listActivityLogs } from "@/lib/activity-api";
import type { ActivityLogEntry } from "@/types/activity";

type ActivityStatus = "idle" | "loading" | "error";

interface ActivityStoreState {
  workspace: ActivityLogEntry[];
  board: Record<string, ActivityLogEntry[]>;
  workspaceStatus: ActivityStatus;
  boardStatus: Record<string, ActivityStatus>;
  loadWorkspace: () => Promise<void>;
  loadBoard: (boardId: string) => Promise<void>;
  appendEvents: (events: ActivityLogEntry[]) => void;
  clear: () => void;
}

const ACTIVITY_LIMIT = 50;
const seenIds = new Set<string>();

function toTimestamp(entry: ActivityLogEntry): number {
  const time = new Date(entry.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function mergeEvents(existing: ActivityLogEntry[], incoming: ActivityLogEntry[]): ActivityLogEntry[] {
  const combined = [...incoming, ...existing];
  combined.sort((a, b) => toTimestamp(b) - toTimestamp(a));
  return combined.slice(0, ACTIVITY_LIMIT);
}

function remember(entries: ActivityLogEntry[]): void {
  entries.forEach((entry) => seenIds.add(entry.id));
}

export const useActivityStore = create<ActivityStoreState>((set) => ({
  workspace: [],
  board: {},
  workspaceStatus: "idle",
  boardStatus: {},

  loadWorkspace: async () => {
    set({ workspaceStatus: "loading" });
    try {
      const data = await listActivityLogs();
      remember(data);
      set({ workspace: data, workspaceStatus: "idle" });
    } catch {
      set({ workspaceStatus: "error" });
    }
  },

  loadBoard: async (boardId) => {
    set((state) => ({
      boardStatus: { ...state.boardStatus, [boardId]: "loading" }
    }));
    try {
      const data = await listActivityLogs(boardId);
      remember(data);
      set((state) => ({
        board: { ...state.board, [boardId]: data },
        boardStatus: { ...state.boardStatus, [boardId]: "idle" }
      }));
    } catch {
      set((state) => ({
        boardStatus: { ...state.boardStatus, [boardId]: "error" }
      }));
    }
  },

  appendEvents: (events) => {
    const fresh = events.filter((entry) => !seenIds.has(entry.id));
    if (fresh.length === 0) {
      return;
    }

    remember(fresh);

    set((state) => {
      const nextWorkspace = mergeEvents(state.workspace, fresh);
      const nextBoard = { ...state.board };
      fresh.forEach((entry) => {
        if (!entry.boardId) return;
        const existing = nextBoard[entry.boardId] ?? [];
        nextBoard[entry.boardId] = mergeEvents(existing, [entry]);
      });
      return { workspace: nextWorkspace, board: nextBoard };
    });
  },

  clear: () => {
    seenIds.clear();
    set({ workspace: [], board: {}, workspaceStatus: "idle", boardStatus: {} });
  }
}));
