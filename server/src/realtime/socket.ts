import type { Server as HttpServer } from "node:http";

import { and, eq, inArray } from "drizzle-orm";
import { Server, type Socket } from "socket.io";

import { isAllowedOrigin } from "../config/env.js";
import { db } from "../db/connection.js";
import { users, workspaceMemberships } from "../db/schema.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { resolveWorkspaceForUser } from "../modules/workspaces/workspaces.service.js";
import { userHasPermission } from "../utils/permissions.js";
import { assertConversationMember } from "../modules/threads/threads.service.access.js";
import { getOptionalWorkspaceId, runWithWorkspaceContext } from "../utils/workspace-context.js";

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

const workspaceRoom = (workspaceId: string) => `workspace:${workspaceId}`;
const boardRoom = (boardId: string) => `board:${boardId}`;
const threadRoom = (conversationId: string) => `thread:${conversationId}`;

let io: Server | null = null;

type SocketNext = (err?: Error) => void;

const userSockets = new Map<string, Set<string>>();
const socketUsers = new Map<string, { userId: string; workspaceId: string }>();
const boardPresence = new Map<string, Map<string, number>>();
const userStatus = new Map<string, PresenceStatus>();
const userLastSeen = new Map<string, number>();

async function getPresenceUsers(workspaceId: string, userIds: string[], statusByUserId?: Map<string, PresenceStatus>): Promise<PresenceUser[]> {
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
      role: workspaceMemberships.role
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(and(eq(workspaceMemberships.workspaceId, workspaceId), inArray(users.id, userIds)));

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

const workspaceUserKey = (workspaceId: string, userId: string) => `${workspaceId}:${userId}`;

async function emitWorkspacePresence(workspaceId: string): Promise<void> {
  if (!io) return;
  const prefix = `${workspaceId}:`;
  const keys = Array.from(userSockets.keys()).filter((key) => key.startsWith(prefix));
  const userIds = keys.map((key) => key.slice(prefix.length));
  const statusByUserId = new Map(userIds.map((userId) => [userId, userStatus.get(workspaceUserKey(workspaceId, userId)) ?? "online"]));
  const usersList = await getPresenceUsers(workspaceId, userIds, statusByUserId);
  const lastSeenByUserId = Object.fromEntries(userIds.flatMap((userId) => {
    const value = userLastSeen.get(workspaceUserKey(workspaceId, userId));
    return value === undefined ? [] : [[userId, value]];
  }));
  io.to(workspaceRoom(workspaceId)).emit("presence:workspace", { users: usersList, lastSeenByUserId });
}

async function emitBoardPresence(workspaceId: string, boardId: string): Promise<void> {
  if (!io) return;
  const entries = boardPresence.get(boardId);
  const userIds = entries ? Array.from(entries.keys()) : [];
  const usersList = await getPresenceUsers(workspaceId, userIds, userStatus);
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

  io.use(async (socket: Socket, next: SocketNext) => {
    const token = typeof socket.handshake.auth?.token === "string"
      ? socket.handshake.auth.token
      : null;

    if (!token) {
      return next(new Error("Unauthorized"));
    }

    try {
      const payload = verifyAccessToken(token);
      const requestedWorkspace = typeof socket.handshake.auth?.workspaceId === "string"
        ? socket.handshake.auth.workspaceId.trim()
        : null;
      const workspace = await resolveWorkspaceForUser(payload.sub, requestedWorkspace);
      socket.data.userId = payload.sub;
      socket.data.workspaceId = workspace.id;
      return next();
    } catch (error) {
      return next(error instanceof Error ? error : new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    const workspaceId = socket.data.workspaceId as string;
    const userKey = workspaceUserKey(workspaceId, userId);
    socketUsers.set(socket.id, { userId, workspaceId });
    addUserSocket(userKey, socket.id);
    userLastSeen.delete(userKey);
    userStatus.set(userKey, userStatus.get(userKey) ?? "online");

    socket.join(workspaceRoom(workspaceId));
    void emitWorkspacePresence(workspaceId);

    const joinedBoards = new Set<string>();

    socket.on("board:join", async (payload: { boardId?: string }) => {
      const boardId = payload?.boardId;
      if (!boardId) return;
      const allowed = await runWithWorkspaceContext({ workspaceId, userId }, () => (
        userHasPermission(userId, "view_boards", { scopeType: "board", scopeId: boardId })
      ));
      if (!allowed) return;
      socket.join(boardRoom(boardId));
      joinedBoards.add(boardId);
      incrementBoardPresence(boardId, userId);
      void emitBoardPresence(workspaceId, boardId);
    });

    socket.on("board:leave", (payload: { boardId?: string }) => {
      const boardId = payload?.boardId;
      if (!boardId) return;
      socket.leave(boardRoom(boardId));
      joinedBoards.delete(boardId);
      decrementBoardPresence(boardId, userId);
      void emitBoardPresence(workspaceId, boardId);
    });

    socket.on("thread:join", async (payload: { conversationId?: string }) => {
      const conversationId = payload?.conversationId;
      if (!conversationId) return;
      try {
        await runWithWorkspaceContext({ workspaceId, userId }, () => assertConversationMember(userId, conversationId));
      } catch {
        return;
      }
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
      userStatus.set(userKey, status);
      void emitWorkspacePresence(workspaceId);
      joinedBoards.forEach((boardId) => void emitBoardPresence(workspaceId, boardId));
    });

    socket.on("presence:ping", () => {
      // no-op for now; keeps connection warm
    });

    socket.on("disconnect", () => {
      socketUsers.delete(socket.id);
      const stillOnline = removeUserSocket(userKey, socket.id);
      if (!stillOnline) {
        userStatus.delete(userKey);
        userLastSeen.set(userKey, Date.now());
      }
      void emitWorkspacePresence(workspaceId);

      joinedBoards.forEach((boardId) => {
        decrementBoardPresence(boardId, userId);
        void emitBoardPresence(workspaceId, boardId);
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

export function emitActivityEvent(workspaceId: string, payload: Record<string, unknown>): void {
  if (!io) return;
  io.to(workspaceRoom(workspaceId)).emit("activity:new", payload);
  if (typeof payload.boardId === "string") {
    io.to(boardRoom(payload.boardId)).emit("activity:new", payload);
  }
}

export function emitThreadEvent(conversationId: string, event: string, payload: ThreadEventPayload): void {
  if (!io) return;
  io.to(threadRoom(conversationId)).emit(event, payload);
  const workspaceId = getOptionalWorkspaceId();
  if (workspaceId) {
    io.to(workspaceRoom(workspaceId)).emit(event, payload);
  }
}
