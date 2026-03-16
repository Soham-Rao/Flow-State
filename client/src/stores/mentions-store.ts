import { create } from "zustand";

import { getUnreadMentions } from "@/lib/mentions-api";
import type { MentionUnreadCounts } from "@/types/mentions";

interface MentionStoreState {
  counts: MentionUnreadCounts | null;
  status: "idle" | "loading" | "error";
  refresh: () => Promise<void>;
  setCounts: (counts: MentionUnreadCounts) => void;
}

export const useMentionStore = create<MentionStoreState>((set) => ({
  counts: null,
  status: "idle",
  refresh: async () => {
    set({ status: "loading" });
    try {
      const counts = await getUnreadMentions();
      set({ counts, status: "idle" });
    } catch {
      set({ status: "error" });
    }
  },
  setCounts: (counts) => set({ counts })
}));
