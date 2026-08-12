import { create } from "zustand";
import { io, type Socket } from "socket.io-client";

import { invalidateApiCacheByTag } from "@/lib/api-client";
import { getActiveWorkspaceId, getSessionToken } from "@/lib/session";
import { useActivityStore } from "@/stores/activity-store";
import { usePresenceStore } from "@/stores/presence-store";
import type { ActivityLogEntry } from "@/types/activity";
import type { PresenceStatus, PresenceUser } from "@/types/presence";

type SocketStatus = "idle" | "connecting" | "connected" | "error";

type BoardEventPayload = { boardId: string; type: string; data?: Record<string, unknown> };
type ThreadEventPayload = { conversationId: string; data?: Record<string, unknown> };
type ThreadEvent = { event: string; payload: ThreadEventPayload };
type BoardEventsListener = (events: BoardEventPayload[]) => void;
type ThreadEventsListener = (events: ThreadEvent[]) => void;

interface SocketStoreState {
  status: SocketStatus;
  connect: () => void;
  disconnect: () => void;
  joinBoard: (boardId: string) => void;
  leaveBoard: (boardId: string) => void;
  joinThread: (conversationId: string) => void;
  leaveThread: (conversationId: string) => void;
  subscribeBoardEvents: (listener: BoardEventsListener) => () => void;
  subscribeThreadEvents: (listener: ThreadEventsListener) => () => void;
  setPresenceStatus: (status: PresenceStatus) => void;
}

const ACTIVITY_BATCH_MS = 350;
const BOARD_EVENT_BATCH_MS = 300;
const THREAD_EVENT_BATCH_MS = 300;
const PRESENCE_STATUS_KEY = "flowstate:presence:status";
const SOCKET_RECONNECT_ATTEMPTS = 8;
const SOCKET_RECONNECT_DELAY = 500;
const SOCKET_RECONNECT_DELAY_MAX = 3000;
const SOCKET_TIMEOUT_MS = 5000;
const HEALTH_TIMEOUT_MS = 1500;
const HEALTH_RETRY_MS = 1000;

let activeSocket: Socket | null = null;
let activeToken: string | null = null;
let activeWorkspaceId: string | null = null;
let healthCheckInFlight = false;
let healthRetryTimer: number | null = null;
let activityQueue: ActivityLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let preferredStatus: PresenceStatus = "online";

let boardQueue: BoardEventPayload[] = [];
let boardFlushTimer: ReturnType<typeof setTimeout> | null = null;
let threadQueue: ThreadEvent[] = [];
let threadFlushTimer: ReturnType<typeof setTimeout> | null = null;

const boardListeners = new Set<BoardEventsListener>();
const threadListeners = new Set<ThreadEventsListener>();

try {
  const stored = localStorage.getItem(PRESENCE_STATUS_KEY);
  if (stored === "online" || stored === "afk") {
    preferredStatus = stored;
  }
} catch {
  // ignore storage errors
}


function getHealthUrl(): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
  if (apiBase.startsWith("http")) {
    return `${apiBase}/health`;
  }
  return `${apiBase}/health`;
}

async function isApiHealthy(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(getHealthUrl(), { signal: controller.signal, credentials: "include" });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
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
  invalidateApiCacheByTag(["activity:workspace", "dashboard:summary"]);
  if (entry.boardId) {
    invalidateApiCacheByTag(`activity:board:${entry.boardId}`);
  }
  activityQueue.push(entry);
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushActivityQueue();
  }, ACTIVITY_BATCH_MS);
}

function flushBoardQueue(): void {
  if (boardQueue.length === 0) return;
  const batch = boardQueue;
  boardQueue = [];
  boardListeners.forEach((listener) => listener(batch));
}

function enqueueBoardEvent(entry: BoardEventPayload): void {
  boardQueue.push(entry);
  if (boardFlushTimer !== null) return;
  boardFlushTimer = setTimeout(() => {
    boardFlushTimer = null;
    flushBoardQueue();
  }, BOARD_EVENT_BATCH_MS);
}

function flushThreadQueue(): void {
  if (threadQueue.length === 0) return;
  const batch = threadQueue;
  threadQueue = [];
  threadListeners.forEach((listener) => listener(batch));
}

function enqueueThreadEvent(event: string, payload: ThreadEventPayload): void {
  invalidateApiCacheByTag(["threads:dms", "threads:channels", "dashboard:summary"]);
  threadQueue.push({ event, payload });
  if (threadFlushTimer !== null) return;
  threadFlushTimer = setTimeout(() => {
    threadFlushTimer = null;
    flushThreadQueue();
  }, THREAD_EVENT_BATCH_MS);
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
    const workspaceId = getActiveWorkspaceId();
    if (!token || !workspaceId) {
      set({ status: "idle" });
      return;
    }

    if (activeSocket && activeToken === token && activeWorkspaceId === workspaceId && activeSocket.connected) {
      return;
    }

    if (healthRetryTimer) {
      window.clearTimeout(healthRetryTimer);
      healthRetryTimer = null;
    }

    if (healthCheckInFlight) {
      return;
    }

    healthCheckInFlight = true;
    set({ status: "connecting" });
    void isApiHealthy().then((ok) => {
      healthCheckInFlight = false;
      if (!ok) {
        set({ status: "idle" });
        healthRetryTimer = window.setTimeout(() => {
          healthRetryTimer = null;
          useSocketStore.getState().connect();
        }, HEALTH_RETRY_MS);
        return;
      }

      if (activeSocket) {
        activeSocket.disconnect();
        activeSocket = null;
      }

      const socketUrl = getSocketUrl();
      const socket = io(socketUrl ?? "/", {
        auth: { token, workspaceId },
        autoConnect: false,
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
        reconnectionDelay: SOCKET_RECONNECT_DELAY,
        reconnectionDelayMax: SOCKET_RECONNECT_DELAY_MAX,
        timeout: SOCKET_TIMEOUT_MS
      });

      activeSocket = socket;
      activeToken = token;
      activeWorkspaceId = workspaceId;
      set({ status: "connecting" });

      socket.on("connect", () => {
        set({ status: "connected" });
        socket.emit("presence:set", { status: preferredStatus });
      });
      socket.on("disconnect", () => set({ status: "idle" }));
      socket.on("connect_error", () => set({ status: "error" }));
      socket.on("reconnect_attempt", () => set({ status: "connecting" }));
      socket.on("reconnect_failed", () => set({ status: "error" }));
      socket.on("activity:new", (payload: ActivityLogEntry) => enqueueActivity(payload));
      socket.on("board:event", (payload: BoardEventPayload) => enqueueBoardEvent(payload));

      const threadEvents = [
        "threads:message:new",
        "threads:message:edit",
        "threads:message:delete",
        "threads:reply:new",
        "threads:reply:edit",
        "threads:reply:delete",
        "threads:reaction"
      ];
      threadEvents.forEach((event) => {
        socket.on(event, (payload: ThreadEventPayload) => enqueueThreadEvent(event, payload));
      });

      socket.on("presence:workspace", (payload: { users?: PresenceUser[]; lastSeenByUserId?: Record<string, number> }) => {
        usePresenceStore.getState().setWorkspace(payload.users ?? [], payload.lastSeenByUserId);
      });
      socket.on("presence:board", (payload: { boardId?: string; users?: PresenceUser[] }) => {
        if (!payload.boardId) return;
        usePresenceStore.getState().setBoard(payload.boardId, payload.users ?? []);
      });

      socket.connect();
    });
  },

  disconnect: () => {
    if (activeSocket) {
      activeSocket.disconnect();
      activeSocket = null;
      activeToken = null;
      activeWorkspaceId = null;
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

  joinThread: (conversationId) => {
    if (!activeSocket || !activeSocket.connected) return;
    activeSocket.emit("thread:join", { conversationId });
  },

  leaveThread: (conversationId) => {
    if (!activeSocket || !activeSocket.connected) return;
    activeSocket.emit("thread:leave", { conversationId });
  },

  subscribeBoardEvents: (listener) => {
    boardListeners.add(listener);
    return () => {
      boardListeners.delete(listener);
    };
  },

  subscribeThreadEvents: (listener) => {
    threadListeners.add(listener);
    return () => {
      threadListeners.delete(listener);
    };
  },

  setPresenceStatus: (status) => {
    setPreferredStatus(status);
  }
}));

