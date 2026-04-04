import type { Server as HttpServer } from "node:http";

import { inArray } from "drizzle-orm";
import { Server, type Socket } from "socket.io";

import { isAllowedOrigin } from "../config/env.js";
import { db } from "../db/connection.js";
import { users } from "../db/schema.js";
import { verifyAccessToken } from "../utils/jwt.js";

export type PresenceStatus = "online" | "afk";

export interface PresenceUser {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  role: string;
  status: PresenceStatus;
}

export interface BoardEventPayload {
  boardId: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface ThreadEventPayload {
  conversationId: string;
  data?: Record<string, unknown>;
}

const WORKSPACE_ID = "default";
const WORKSPACE_ROOM = `workspace:${WORKSPACE_ID}`;
const boardRoom = (boardId: string) => `board:${boardId}`;
const threadRoom = (conversationId: string) => `thread:${conversationId}`;

let io: Server | null = null;

type SocketNext = (err?: Error) => void;

const userSockets = new Map<string, Set<string>>();
const socketUsers = new Map<string, string>();
const boardPresence = new Map<string, Map<string, number>>();
const userStatus = new Map<string, PresenceStatus>();
const userLastSeen = new Map<string, number>();

async function getPresenceUsers(userIds: string[], statusByUserId?: Map<string, PresenceStatus>): Promise<PresenceUser[]> {
  if (userIds.length === 0) {
    return [];
  }

  const rows: Array<{
      id: string;
      name: string;
      displayName: string | null;
      username: string | null;
      email: string;
      role: string;
    }> = await db
    .select({
      id: users.id,
      name: users.name,
      displayName: users.displayName,
      username: users.username,
      email: users.email,
      role: users.role
    })
    .from(users)
    .where(inArray(users.id, userIds));

  const byId = new Map(rows.map((row) => [row.id, row]));
  return userIds
    .map((id) => byId.get(id))
    .filter((row): row is typeof rows[number] => Boolean(row))
    .map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      username: row.username,
      email: row.email,
      role: row.role,
      status: statusByUserId?.get(row.id) ?? "online"
    }));
}

async function emitWorkspacePresence(): Promise<void> {
  if (!io) return;
  const userIds = Array.from(userSockets.keys());
  const usersList = await getPresenceUsers(userIds, userStatus);
  const lastSeenByUserId = Object.fromEntries(userLastSeen);
  io.to(WORKSPACE_ROOM).emit("presence:workspace", { users: usersList, lastSeenByUserId });
}

async function emitBoardPresence(boardId: string): Promise<void> {
  if (!io) return;
  const entries = boardPresence.get(boardId);
  const userIds = entries ? Array.from(entries.keys()) : [];
  const usersList = await getPresenceUsers(userIds, userStatus);
  io.to(boardRoom(boardId)).emit("presence:board", { boardId, users: usersList });
}

function addUserSocket(userId: string, socketId: string): void {
  const set = userSockets.get(userId) ?? new Set();
  set.add(socketId);
  userSockets.set(userId, set);
}

function removeUserSocket(userId: string, socketId: string): boolean {
  const set = userSockets.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(userId);
    return false;
  }
  return true;
}

function incrementBoardPresence(boardId: string, userId: string): void {
  const map = boardPresence.get(boardId) ?? new Map();
  map.set(userId, (map.get(userId) ?? 0) + 1);
  boardPresence.set(boardId, map);
}

function decrementBoardPresence(boardId: string, userId: string): void {
  const map = boardPresence.get(boardId);
  if (!map) return;
  const next = (map.get(userId) ?? 0) - 1;
  if (next <= 0) {
    map.delete(userId);
  } else {
    map.set(userId, next);
  }
  if (map.size === 0) {
    boardPresence.delete(boardId);
  }
}

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("Not allowed by CORS"));
      },
      credentials: false
    }
  });

  io.use((socket: Socket, next: SocketNext) => {
    const token = typeof socket.handshake.auth?.token === "string"
      ? socket.handshake.auth.token
      : null;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      return next();
    } catch (error) {
      return next(error instanceof Error ? error : new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socketUsers.set(socket.id, userId);
    addUserSocket(userId, socket.id);
    userLastSeen.delete(userId);
    userStatus.set(userId, userStatus.get(userId) ?? "online");

    socket.join(WORKSPACE_ROOM);
    void emitWorkspacePresence();

    const joinedBoards = new Set<string>();

    socket.on("board:join", (payload: { boardId?: string }) => {
      const boardId = payload?.boardId;
      if (!boardId) return;
      socket.join(boardRoom(boardId));
      joinedBoards.add(boardId);
      incrementBoardPresence(boardId, userId);
      void emitBoardPresence(boardId);
    });

    socket.on("board:leave", (payload: { boardId?: string }) => {
      const boardId = payload?.boardId;
      if (!boardId) return;
      socket.leave(boardRoom(boardId));
      joinedBoards.delete(boardId);
      decrementBoardPresence(boardId, userId);
      void emitBoardPresence(boardId);
    });

    socket.on("thread:join", (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      socket.join(threadRoom(conversationId));
    });

    socket.on("thread:leave", (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      socket.leave(threadRoom(conversationId));
    });

    socket.on("presence:set", (payload: { status?: PresenceStatus }) => {
      const status = payload?.status;
      if (status !== "online" && status !== "afk") return;
      userStatus.set(userId, status);
      void emitWorkspacePresence();
      joinedBoards.forEach((boardId) => void emitBoardPresence(boardId));
    });

    socket.on("presence:ping", () => {
      // no-op for now; keeps connection warm
    });

    socket.on("disconnect", () => {
      socketUsers.delete(socket.id);
      const stillOnline = removeUserSocket(userId, socket.id);
      if (!stillOnline) {
        userStatus.delete(userId);
        userLastSeen.set(userId, Date.now());
      }
      void emitWorkspacePresence();

      joinedBoards.forEach((boardId) => {
        decrementBoardPresence(boardId, userId);
        void emitBoardPresence(boardId);
      });
    });
  });

  return io;
}

export async function closeSocketServer(): Promise<void> {
  if (!io) return;

  await new Promise<void>((resolve, reject) => {
    io?.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  io = null;
  userSockets.clear();
  socketUsers.clear();
  boardPresence.clear();
  userStatus.clear();
  userLastSeen.clear();
}

export function getSocketServer(): Server | null {
  return io;
}

export function emitBoardEvent(boardId: string, payload: BoardEventPayload): void {
  if (!io) return;
  io.to(boardRoom(boardId)).emit("board:event", payload);
}

export function emitActivityEvent(payload: Record<string, unknown>): void {
  if (!io) return;
  io.to(WORKSPACE_ROOM).emit("activity:new", payload);
  if (typeof payload.boardId === "string") {
    io.to(boardRoom(payload.boardId)).emit("activity:new", payload);
  }
}

export function emitThreadEvent(conversationId: string, event: string, payload: ThreadEventPayload): void {
  if (!io) return;
  io.to(threadRoom(conversationId)).emit(event, payload);
  io.to(WORKSPACE_ROOM).emit(event, payload);
}
