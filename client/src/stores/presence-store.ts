import { create } from "zustand";

import type { PresenceUser } from "@/types/presence";

interface PresenceStoreState {
  workspace: PresenceUser[];
  board: Record<string, PresenceUser[]>;
  lastSeenByUserId: Record<string, number>;
  setWorkspace: (users: PresenceUser[], lastSeenByUserId?: Record<string, number>) => void;
  setLastSeenByUserId: (lastSeenByUserId: Record<string, number>) => void;
  setBoard: (boardId: string, users: PresenceUser[]) => void;
  clearBoard: (boardId: string) => void;
  clearAll: () => void;
}

export const usePresenceStore = create<PresenceStoreState>((set) => ({
  workspace: [],
  board: {},
  lastSeenByUserId: {},

  setWorkspace: (users, lastSeenByUserId) =>
    set((state) => ({
      workspace: users,
      lastSeenByUserId: lastSeenByUserId ?? state.lastSeenByUserId
    })),

  setLastSeenByUserId: (lastSeenByUserId) => set({ lastSeenByUserId }),

  setBoard: (boardId, users) =>
    set((state) => ({
      board: { ...state.board, [boardId]: users }
    })),

  clearBoard: (boardId) =>
    set((state) => {
      if (!(boardId in state.board)) return state;
      const next = { ...state.board };
      delete next[boardId];
      return { board: next };
    }),

  clearAll: () => set({ workspace: [], board: {}, lastSeenByUserId: {} })
}));
