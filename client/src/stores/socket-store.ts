import { create } from "zustand";
import { io, type Socket } from "socket.io-client";

import { getSessionToken } from "@/lib/session";
import { useActivityStore } from "@/stores/activity-store";
import { usePresenceStore } from "@/stores/presence-store";
import type { ActivityLogEntry } from "@/types/activity";
import type { PresenceStatus, PresenceUser } from "@/types/presence";

type SocketStatus = "idle" | "connecting" | "connected" | "error";

interface SocketStoreState {
  status: SocketStatus;
  connect: () => void;
  disconnect: () => void;
  joinBoard: (boardId: string) => void;
  leaveBoard: (boardId: string) => void;
  setPresenceStatus: (status: PresenceStatus) => void;
}

const ACTIVITY_BATCH_MS = 350;
const PRESENCE_STATUS_KEY = "flowstate:presence:status";

let activeSocket: Socket | null = null;
let activeToken: string | null = null;
let activityQueue: ActivityLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let preferredStatus: PresenceStatus = "online";

try {
  const stored = localStorage.getItem(PRESENCE_STATUS_KEY);
  if (stored === "online" || stored === "afk") {
    preferredStatus = stored;
  }
} catch {
  // ignore storage errors
}

function getSocketUrl(): string | undefined {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
  if (apiBase.startsWith("http")) {
    return apiBase.replace(/\/api\/?$/, "");
  }
  return undefined;
}

function flushActivityQueue(): void {
  if (activityQueue.length === 0) return;
  const batch = activityQueue;
  activityQueue = [];
  useActivityStore.getState().appendEvents(batch);
}

function enqueueActivity(entry: ActivityLogEntry): void {
  activityQueue.push(entry);
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushActivityQueue();
  }, ACTIVITY_BATCH_MS);
}

function setPreferredStatus(status: PresenceStatus): void {
  preferredStatus = status;
  try {
    localStorage.setItem(PRESENCE_STATUS_KEY, status);
  } catch {
    // ignore storage errors
  }
  if (activeSocket?.connected) {
    activeSocket.emit("presence:set", { status });
  }
}

export const useSocketStore = create<SocketStoreState>((set) => ({
  status: "idle",

  connect: () => {
    const token = getSessionToken();
    if (!token) {
      set({ status: "idle" });
      return;
    }

    if (activeSocket && activeToken === token && activeSocket.connected) {
      return;
    }

    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
    }

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl ?? "/", {
      auth: { token },
      autoConnect: false,
      transports: ["websocket"]
    });

    activeSocket = socket;
    activeToken = token;
    set({ status: "connecting" });

    socket.on("connect", () => {
      set({ status: "connected" });
      socket.emit("presence:set", { status: preferredStatus });
    });
    socket.on("disconnect", () => set({ status: "idle" }));
    socket.on("connect_error", () => set({ status: "error" }));
    socket.on("activity:new", (payload: ActivityLogEntry) => enqueueActivity(payload));

    socket.on("presence:workspace", (payload: { users?: PresenceUser[]; lastSeenByUserId?: Record<string, number> }) => {
      usePresenceStore.getState().setWorkspace(payload.users ?? [], payload.lastSeenByUserId);
    });
    socket.on("presence:board", (payload: { boardId?: string; users?: PresenceUser[] }) => {
      if (!payload.boardId) return;
      usePresenceStore.getState().setBoard(payload.boardId, payload.users ?? []);
    });

    socket.connect();
  },

  disconnect: () => {
    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
      activeToken = null;
    }
    usePresenceStore.getState().clearAll();
    set({ status: "idle" });
  },

  joinBoard: (boardId) => {
    if (!activeSocket || !activeSocket.connected) return;
    activeSocket.emit("board:join", { boardId });
  },

  leaveBoard: (boardId) => {
    if (!activeSocket || !activeSocket.connected) return;
    activeSocket.emit("board:leave", { boardId });
  },

  setPresenceStatus: (status) => {
    setPreferredStatus(status);
  }
}));
