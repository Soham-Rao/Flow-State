import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { boards, cards, lists, type RetentionMode } from "../../db/schema.js";
import {
  BOARD_ARCHIVE_RETENTION_MINUTES,
  DEFAULT_ARCHIVE_RETENTION_MINUTES,
  DEFAULT_RETENTION_MINUTES,
  DEFAULT_RETENTION_MODE
} from "./boards.service.types.js";
import { clampArchiveRetentionMinutes, clampRetentionMinutes } from "./boards.service.utils.js";
import { deleteAttachmentsForCard } from "./boards.service.cards-data.js";

export async function cleanupExpiredCards(now: Date = new Date()): Promise<void> {
  const rows = db
    .select({
      cardId: cards.id,
      doneEnteredAt: cards.doneEnteredAt,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(isNull(cards.archivedAt), isNotNull(cards.doneEnteredAt)))
    .all() as Array<{
      cardId: string;
      doneEnteredAt: Date | null;
      retentionMode: RetentionMode | null;
      retentionMinutes: number | null;
    }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.doneEnteredAt) continue;
    const retentionMinutes = clampRetentionMinutes(row.retentionMinutes ?? DEFAULT_RETENTION_MINUTES);
    const expiresAt = row.doneEnteredAt.getTime() + retentionMinutes * 60 * 1000;
    if (nowMs < expiresAt) continue;

    const mode = row.retentionMode ?? DEFAULT_RETENTION_MODE;
    if (mode === "attachments_only") {
      await deleteAttachmentsForCard(row.cardId);
      continue;
    }

    await deleteAttachmentsForCard(row.cardId);
    db.delete(cards).where(eq(cards.id, row.cardId)).run();
  }

  await cleanupArchivedCards(now);
  await cleanupArchivedLists(now);
  await cleanupArchivedBoards(now);
}

async function cleanupArchivedCards(now: Date): Promise<void> {
  const rows = db
    .select({
      cardId: cards.id,
      archivedAt: cards.archivedAt,
      boardArchiveRetention: boards.archiveRetentionMinutes
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(isNotNull(cards.archivedAt), isNull(lists.archivedAt), isNull(boards.archivedAt)))
    .all() as Array<{
      cardId: string;
      archivedAt: Date | null;
      boardArchiveRetention: number | null;
    }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.archivedAt) continue;
    const retentionMinutes = clampArchiveRetentionMinutes(row.boardArchiveRetention ?? DEFAULT_ARCHIVE_RETENTION_MINUTES);
    const expiresAt = row.archivedAt.getTime() + retentionMinutes * 60 * 1000;
    if (nowMs < expiresAt) continue;

    await deleteAttachmentsForCard(row.cardId);
    db.delete(cards).where(eq(cards.id, row.cardId)).run();
  }
}

async function cleanupArchivedLists(now: Date): Promise<void> {
  const rows = db
    .select({
      listId: lists.id,
      archivedAt: lists.archivedAt,
      boardArchiveRetention: boards.archiveRetentionMinutes
    })
    .from(lists)
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(isNotNull(lists.archivedAt), isNull(boards.archivedAt)))
    .all() as Array<{
      listId: string;
      archivedAt: Date | null;
      boardArchiveRetention: number | null;
    }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.archivedAt) continue;
    const retentionMinutes = clampArchiveRetentionMinutes(row.boardArchiveRetention ?? DEFAULT_ARCHIVE_RETENTION_MINUTES);
    const expiresAt = row.archivedAt.getTime() + retentionMinutes * 60 * 1000;
    if (nowMs < expiresAt) continue;

    const cardRows = db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.listId, row.listId))
      .all() as Array<{ id: string }>;

    for (const card of cardRows) {
      await deleteAttachmentsForCard(card.id);
    }

    db.delete(lists).where(eq(lists.id, row.listId)).run();
  }
}

async function cleanupArchivedBoards(now: Date): Promise<void> {
  const rows = db
    .select({
      boardId: boards.id,
      archivedAt: boards.archivedAt
    })
    .from(boards)
    .where(isNotNull(boards.archivedAt))
    .all() as Array<{ boardId: string; archivedAt: Date | null }>;

  const nowMs = now.getTime();

  for (const row of rows) {
    if (!row.archivedAt) continue;
    const expiresAt = row.archivedAt.getTime() + BOARD_ARCHIVE_RETENTION_MINUTES * 60 * 1000;
    if (nowMs < expiresAt) continue;

    const cardRows = db
      .select({ id: cards.id })
      .from(cards)
      .innerJoin(lists, eq(cards.listId, lists.id))
      .where(eq(lists.boardId, row.boardId))
      .all() as Array<{ id: string }>;

    for (const card of cardRows) {
      await deleteAttachmentsForCard(card.id);
    }

    db.delete(boards).where(eq(boards.id, row.boardId)).run();
  }
}
