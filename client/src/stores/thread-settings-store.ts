import { create } from "zustand";

export type ThreadBadgeMode = "all" | "mentions" | "never";

const THREAD_BADGE_MODE_KEY = "flowstate:threads:badge-mode";

function normalizeThreadBadgeMode(value: string | null): ThreadBadgeMode {
  if (value === "all" || value === "mentions" || value === "never") {
    return value;
  }
  return "mentions";
}

function getInitialBadgeMode(): ThreadBadgeMode {
  if (typeof window === "undefined") {
    return "mentions";
  }
  try {
    return normalizeThreadBadgeMode(window.localStorage.getItem(THREAD_BADGE_MODE_KEY));
  } catch {
    return "mentions";
  }
}

interface ThreadSettingsState {
  threadBadgeMode: ThreadBadgeMode;
  setThreadBadgeMode: (mode: ThreadBadgeMode) => void;
}

export const useThreadSettingsStore = create<ThreadSettingsState>((set) => ({
  threadBadgeMode: getInitialBadgeMode(),
  setThreadBadgeMode: (mode) => {
    set({ threadBadgeMode: mode });
    try {
      window.localStorage.setItem(THREAD_BADGE_MODE_KEY, mode);
    } catch {
      // ignore storage failures
    }
  }
}));
