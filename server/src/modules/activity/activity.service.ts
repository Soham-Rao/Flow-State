import crypto from "node:crypto";

import { desc, eq, lt } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { emitActivityEvent, emitBoardEvent } from "../../realtime/socket.js";
import { activityLogs, users } from "../../db/schema.js";

export interface ActivityActor {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  role: string;
}

export interface ActivityLogEntry {
  id: string;
  type: string;
  actor: ActivityActor;
  boardId: string | null;
  listId: string | null;
  cardId: string | null;
  threadConversationId: string | null;
  threadMessageId: string | null;
  threadReplyId: string | null;
  mentionedUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

const RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

function mapActivityRow(row: {
  id: string;
  type: string;
  boardId: string | null;
  listId: string | null;
  cardId: string | null;
  threadConversationId: string | null;
  threadMessageId: string | null;
  threadReplyId: string | null;
  mentionedUserId: string | null;
  metadata: string | null;
  createdAt: Date;
  actorId: string;
  actorName: string;
  actorDisplayName: string | null;
  actorUsername: string | null;
  actorEmail: string;
  actorRole: string;
}): ActivityLogEntry {
  return {
    id: row.id,
    type: row.type,
    boardId: row.boardId,
    listId: row.listId,
    cardId: row.cardId,
    threadConversationId: row.threadConversationId,
    threadMessageId: row.threadMessageId,
    threadReplyId: row.threadReplyId,
    mentionedUserId: row.mentionedUserId,
    metadata: parseMetadata(row.metadata),
    createdAt: row.createdAt,
    actor: {
      id: row.actorId,
      name: row.actorName,
      displayName: row.actorDisplayName,
      username: row.actorUsername,
      email: row.actorEmail,
      role: row.actorRole
    }
  };
}

export function createActivityLog(input: {
  type: string;
  actorId: string;
  boardId?: string | null;
  listId?: string | null;
  cardId?: string | null;
  threadConversationId?: string | null;
  threadMessageId?: string | null;
  threadReplyId?: string | null;
  mentionedUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}): ActivityLogEntry {
  const now = new Date();
  const id = crypto.randomUUID();

  db.insert(activityLogs)
    .values({
      id,
      type: input.type,
      actorId: input.actorId,
      boardId: input.boardId ?? null,
      listId: input.listId ?? null,
      cardId: input.cardId ?? null,
      threadConversationId: input.threadConversationId ?? null,
      threadMessageId: input.threadMessageId ?? null,
      threadReplyId: input.threadReplyId ?? null,
      mentionedUserId: input.mentionedUserId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: now
    })
    .run();

  const cutoff = new Date(Date.now() - RETENTION_MS);
  db.delete(activityLogs)
    .where(lt(activityLogs.createdAt, cutoff))
    .run();

  const row = db
    .select({
      id: activityLogs.id,
      type: activityLogs.type,
      boardId: activityLogs.boardId,
      listId: activityLogs.listId,
      cardId: activityLogs.cardId,
      threadConversationId: activityLogs.threadConversationId,
      threadMessageId: activityLogs.threadMessageId,
      threadReplyId: activityLogs.threadReplyId,
      mentionedUserId: activityLogs.mentionedUserId,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
      actorId: users.id,
      actorName: users.name,
      actorDisplayName: users.displayName,
      actorUsername: users.username,
      actorEmail: users.email,
      actorRole: users.role
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.actorId, users.id))
    .where(eq(activityLogs.id, id))
    .get();

  if (!row) {
    return {
      id,
      type: input.type,
      actor: {
        id: input.actorId,
        name: "Unknown",
        displayName: null,
        username: null,
        email: "",
        role: "guest"
      },
      boardId: input.boardId ?? null,
      listId: input.listId ?? null,
      cardId: input.cardId ?? null,
      threadConversationId: input.threadConversationId ?? null,
      threadMessageId: input.threadMessageId ?? null,
      threadReplyId: input.threadReplyId ?? null,
      mentionedUserId: input.mentionedUserId ?? null,
      metadata: input.metadata ?? null,
      createdAt: now
    };
  }

  return mapActivityRow(row);
}

export function recordActivity(input: {
  type: string;
  actorId: string;
  boardId?: string | null;
  listId?: string | null;
  cardId?: string | null;
  threadConversationId?: string | null;
  threadMessageId?: string | null;
  threadReplyId?: string | null;
  mentionedUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}): ActivityLogEntry {
  const entry = createActivityLog(input);
  emitActivityEvent({ ...entry, createdAt: entry.createdAt.toISOString() });
  if (entry.boardId) {
    emitBoardEvent(entry.boardId, { boardId: entry.boardId, type: "board.activity", data: { activityType: entry.type } });
  }
  return entry;
}

export function listActivityLogs(params: { boardId?: string; limit?: number }): ActivityLogEntry[] {
  const limit = params.limit ?? 50;
  const query = db
    .select({
      id: activityLogs.id,
      type: activityLogs.type,
      boardId: activityLogs.boardId,
      listId: activityLogs.listId,
      cardId: activityLogs.cardId,
      threadConversationId: activityLogs.threadConversationId,
      threadMessageId: activityLogs.threadMessageId,
      threadReplyId: activityLogs.threadReplyId,
      mentionedUserId: activityLogs.mentionedUserId,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
      actorId: users.id,
      actorName: users.name,
      actorDisplayName: users.displayName,
      actorUsername: users.username,
      actorEmail: users.email,
      actorRole: users.role
    })
    .from(activityLogs)
    .innerJoin(users, eq(activityLogs.actorId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);

  if (params.boardId) {
    query.where(eq(activityLogs.boardId, params.boardId));
  }

  const rows = query.all();
  return rows.map(mapActivityRow);
}


