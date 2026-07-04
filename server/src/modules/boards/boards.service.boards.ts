import crypto from "node:crypto";

import { and, asc, count, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db, type DbTransaction } from "../../db/connection.js";
import { recordActivity } from "../activity/activity.service.js";
import { boards, cards, lists, boardMembers, boardMemberPermissions, type RetentionMode } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { getUserPermissions } from "../../utils/permissions.js";
import type {
  ArchivedListEntry,
  BoardCard,
  BoardDetail,
  BoardList,
  BoardSummary,
  CardRecord
} from "./boards.service.types.js";
import { DEFAULT_ARCHIVE_RETENTION_MINUTES, DEFAULT_RETENTION_MINUTES, DEFAULT_RETENTION_MODE, defaultLists } from "./boards.service.types.js";
import { clampArchiveRetentionMinutes, clampRetentionMinutes, normalizeOptionalDescription, normalizeRequiredName } from "./boards.service.utils.js";
import { assertBoardExists, assertBoardNameAvailable, getBoardRecord } from "./boards.service.lookups.js";
import { getBoardMembers } from "./boards.service.members.js";
import { getLabelsForBoard } from "./boards.service.labels-data.js";
import { getCommentsForBoard, getCommentsForLists } from "./boards.service.comments-data.js";
import { attachChecklistsToCards, getBoardSummaryById, getCardsForListIncludingArchived } from "./boards.service.cards-data.js";
import type { CreateBoardInput, UpdateBoardInput } from "./boards.schema.js";

type ArchivedCardRow = CardRecord & { listName: string };

export async function getBoards(userId: string): Promise<BoardSummary[]> {
  const permissions = await getUserPermissions(userId);
  const isSystemAdmin = permissions.has("view_all_boards");

  let query = db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
      archiveRetentionMinutes: boards.archiveRetentionMinutes,
      archivedAt: boards.archivedAt,
      createdBy: boards.createdBy,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt
    })
    .from(boards);

  if (!isSystemAdmin) {
    query = query
      .leftJoin(boardMembers, and(eq(boardMembers.boardId, boards.id), eq(boardMembers.userId, userId)))
      .where(
        or(
          eq(boards.createdBy, userId),
          isNotNull(boardMembers.userId)
        )
      ) as any;
  }

  const boardRows: Array<Omit<BoardSummary, "listCount">> = await query.orderBy(asc(boards.name));

  const countRows: Array<{ boardId: string; listCount: number }> = await db
    .select({
      boardId: lists.boardId,
      listCount: count(lists.id)
    })
    .from(lists)
    .where(isNull(lists.archivedAt))
    .groupBy(lists.boardId);

  const countsByBoardId = new Map(countRows.map((row) => [row.boardId, row.listCount]));

  return boardRows.map((row) => ({
    ...row,
    listCount: countsByBoardId.get(row.id) ?? 0
  }));
}

export async function getBoardById(boardId: string): Promise<BoardDetail> {
  const boardRows: Array<Omit<BoardSummary, "listCount">> = await db
    .select({
      id: boards.id,
      name: boards.name,
      description: boards.description,
      background: boards.background,
      retentionMode: boards.retentionMode,
      retentionMinutes: boards.retentionMinutes,
      archiveRetentionMinutes: boards.archiveRetentionMinutes,
      archivedAt: boards.archivedAt,
      createdBy: boards.createdBy,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt
    })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  const board = boardRows[0];

  if (!board) {
    throw new ApiError(404, "Board not found");
  }

  const boardLists: Array<Omit<BoardList, "cards" | "comments">> = await db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      position: lists.position,
      isDoneList: lists.isDoneList,
      archivedAt: lists.archivedAt,
      createdAt: lists.createdAt,
      updatedAt: lists.updatedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt)))
    .orderBy(asc(lists.position), asc(lists.createdAt));

  const boardCardRows: CardRecord[] = await db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNull(cards.archivedAt)))
    .orderBy(asc(cards.position), asc(cards.createdAt));

  const boardCards = await attachChecklistsToCards(boardCardRows as CardRecord[]);

  const cardsByListId = new Map<string, BoardCard[]>();
  for (const card of boardCards) {
    const existing = cardsByListId.get(card.listId) ?? [];
    existing.push(card);
    cardsByListId.set(card.listId, existing);
  }

  const listCommentsByListId = await getCommentsForLists(boardLists.map((list) => list.id));
  const boardComments = await getCommentsForBoard(boardId);

  return {
    ...board,
    lists: boardLists.map((list) => ({
      ...list,
      cards: cardsByListId.get(list.id) ?? [],
      comments: listCommentsByListId.get(list.id) ?? []
    })),
    labels: await getLabelsForBoard(boardId),
    members: await getBoardMembers(),
    comments: boardComments
  };
}

export async function getArchivedLists(boardId: string): Promise<ArchivedListEntry[]> {
  await assertBoardExists(boardId);

  const archivedLists: Array<{ id: string; boardId: string; name: string; archivedAt: Date | null }> = await db
    .select({
      id: lists.id,
      boardId: lists.boardId,
      name: lists.name,
      archivedAt: lists.archivedAt
    })
    .from(lists)
    .where(and(eq(lists.boardId, boardId), isNotNull(lists.archivedAt)))
    .orderBy(asc(lists.archivedAt), asc(lists.createdAt));

  const archivedListEntries: ArchivedListEntry[] = [];
  for (const list of archivedLists) {
    archivedListEntries.push({
      id: list.id,
      sourceListId: list.id,
      name: list.name,
      archivedAt: list.archivedAt,
      kind: "list",
      cards: await getCardsForListIncludingArchived(list.id)
    });
  }

  const archivedCardRows: Array<ArchivedCardRow> = await db
    .select({
      id: cards.id,
      listId: cards.listId,
      title: cards.title,
      description: cards.description,
      priority: cards.priority,
      coverColor: cards.coverColor,
      dueDate: cards.dueDate,
      position: cards.position,
      createdBy: cards.createdBy,
      archivedAt: cards.archivedAt,
      doneEnteredAt: cards.doneEnteredAt,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
      listName: lists.name
    })
    .from(cards)
    .innerJoin(lists, eq(cards.listId, lists.id))
    .where(and(eq(lists.boardId, boardId), isNull(lists.archivedAt), isNotNull(cards.archivedAt)))
    .orderBy(asc(cards.archivedAt), asc(cards.createdAt));

  const listNameById = new Map(archivedCardRows.map((row) => [row.listId, row.listName]));
  const archivedCards = await attachChecklistsToCards(
    archivedCardRows.map(({ listName: _listName, ...card }) => card) as CardRecord[]
  );

  const archivedCardsByListId = new Map<string, BoardCard[]>();
  for (const card of archivedCards) {
    const list = archivedCardsByListId.get(card.listId) ?? [];
    list.push(card);
    archivedCardsByListId.set(card.listId, list);
  }

  const archivedCardEntries: ArchivedListEntry[] = Array.from(archivedCardsByListId.entries()).map(([listId, cards]) => {
    const listName = listNameById.get(listId) ?? "Archived";
    const archivedAt = cards.reduce<Date | null>((current, card) => {
      if (!card.archivedAt) return current;
      if (!current) return card.archivedAt;
      return card.archivedAt < current ? card.archivedAt : current;
    }, null);
    return {
      id: `archived-cards:${listId}`,
      sourceListId: listId,
      name: `${listName} - archived`,
      archivedAt,
      kind: "cards",
      cards
    };
  });

  return [...archivedListEntries, ...archivedCardEntries];
}

export async function createBoard(input: CreateBoardInput, userId: string): Promise<BoardDetail> {
  const now = new Date();
  const boardId = crypto.randomUUID();
  const trimmedName = normalizeRequiredName(input.name, "Board name", 2, 120);
  const retentionMinutes = clampRetentionMinutes(input.retentionMinutes ?? DEFAULT_RETENTION_MINUTES);
  const retentionMode = input.retentionMode ?? DEFAULT_RETENTION_MODE;
  const archiveRetentionMinutes = clampArchiveRetentionMinutes(
    input.archiveRetentionMinutes ?? DEFAULT_ARCHIVE_RETENTION_MINUTES
  );

  await assertBoardNameAvailable(trimmedName);

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(boards)
      .values({
        id: boardId,
        name: trimmedName,
        description: normalizeOptionalDescription(input.description),
        background: input.background,
        retentionMode,
        retentionMinutes,
        archiveRetentionMinutes,
        archivedAt: null,
        createdBy: userId,
        createdAt: now,
        updatedAt: now
      })
      .execute();

    for (const [index, list] of defaultLists.entries()) {
      await tx.insert(lists)
        .values({
          id: crypto.randomUUID(),
          boardId,
          name: list.name,
          position: index,
          isDoneList: list.isDoneList,
          archivedAt: null,
          createdAt: now,
          updatedAt: now
        })
        .execute();
    }
  });

  await recordActivity({
    type: "board.created",
    actorId: userId,
    boardId,
    metadata: { boardName: trimmedName }
  });

  return getBoardById(boardId);
}

export async function updateBoard(boardId: string, input: UpdateBoardInput, userId: string): Promise<BoardDetail> {
  await assertBoardExists(boardId);

  const updatePayload: {
    name?: string;
    description?: string | null;
    background?: string;
    retentionMode?: RetentionMode;
    retentionMinutes?: number;
    archiveRetentionMinutes?: number;
    updatedAt: Date;
  } = {
    updatedAt: new Date()
  };

  if (input.name !== undefined) {
    const trimmed = normalizeRequiredName(input.name, "Board name", 2, 120);
    await assertBoardNameAvailable(trimmed, boardId);
    updatePayload.name = trimmed;
  }

  if (input.description !== undefined) {
    updatePayload.description = normalizeOptionalDescription(input.description);
  }

  if (input.background !== undefined) {
    updatePayload.background = input.background;
  }

  if (input.retentionMode !== undefined) {
    updatePayload.retentionMode = input.retentionMode;
  }

  if (input.retentionMinutes !== undefined) {
    updatePayload.retentionMinutes = clampRetentionMinutes(input.retentionMinutes);
  }

  if (input.archiveRetentionMinutes !== undefined) {
    updatePayload.archiveRetentionMinutes = clampArchiveRetentionMinutes(input.archiveRetentionMinutes);
  }

  await db.update(boards).set(updatePayload).where(eq(boards.id, boardId)).execute();

  const updated = await getBoardById(boardId);
  await recordActivity({
    type: "board.updated",
    actorId: userId,
    boardId,
    metadata: { boardName: updated.name }
  });
  return updated;
}

export async function deleteBoard(boardId: string, userId: string): Promise<void> {
  const board = await getBoardRecord(boardId);
  const [result] = await db.delete(boards).where(eq(boards.id, boardId)).execute();

  if (result.affectedRows === 0) {
    throw new ApiError(404, "Board not found");
  }

  await recordActivity({
    type: "board.deleted",
    actorId: userId,
    boardId: null,
    metadata: { boardName: board.name }
  });
}

export async function archiveBoard(boardId: string, userId: string): Promise<BoardSummary> {
  const board = await getBoardRecord(boardId);
  if (board.archivedAt) {
    return getBoardSummaryById(boardId);
  }

  await db.update(boards)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .execute();

  await recordActivity({
    type: "board.archived",
    actorId: userId,
    boardId,
    metadata: { boardName: board.name }
  });

  return getBoardSummaryById(boardId);
}

export async function restoreBoard(boardId: string, userId: string): Promise<BoardSummary> {
  const board = await getBoardRecord(boardId);
  if (!board.archivedAt) {
    return getBoardSummaryById(boardId);
  }

  await db.update(boards)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .execute();

  await recordActivity({
    type: "board.restored",
    actorId: userId,
    boardId,
    metadata: { boardName: board.name }
  });

  return getBoardSummaryById(boardId);
}

async function assertCanManageBoardMembers(actorId: string, boardId: string): Promise<void> {
  const permissions = await getUserPermissions(actorId);
  const isSystemAdmin = permissions.has("view_all_boards");
  if (isSystemAdmin) return;

  const [board] = await db
    .select({ createdBy: boards.createdBy })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (!board) {
    throw new ApiError(404, "Board not found");
  }

  if (board.createdBy !== actorId) {
    throw new ApiError(403, "Only the board creator or an admin can manage board members");
  }
}

export async function addBoardMembers(
  actorId: string,
  boardId: string,
  userIds: string[]
): Promise<void> {
  await assertCanManageBoardMembers(actorId, boardId);

  const now = new Date();
  const records = userIds.map((userId) => ({
    boardId,
    userId,
    role: "member" as const,
    createdAt: now
  }));

  if (records.length > 0) {
    await db.insert(boardMembers).ignore().values(records).execute();
  }
}

export async function updateBoardMemberOverrides(
  actorId: string,
  boardId: string,
  memberId: string,
  overrides: Array<{ permission: string; access: "allow" | "deny" | "none" }>
): Promise<void> {
  await assertCanManageBoardMembers(actorId, boardId);

  await db.transaction(async (tx) => {
    for (const override of overrides) {
      if (override.access === "none") {
        await tx
          .delete(boardMemberPermissions)
          .where(
            and(
              eq(boardMemberPermissions.boardId, boardId),
              eq(boardMemberPermissions.userId, memberId),
              eq(boardMemberPermissions.permission, override.permission as any)
            )
          );
      } else {
        await tx
          .insert(boardMemberPermissions)
          .values({
            boardId,
            userId: memberId,
            permission: override.permission as any,
            access: override.access,
            createdAt: new Date()
          })
          .onDuplicateKeyUpdate({
            set: {
              access: override.access
            }
          });
      }
    }
  });
}

export async function removeBoardMember(
  actorId: string,
  boardId: string,
  memberId: string
): Promise<void> {
  await assertCanManageBoardMembers(actorId, boardId);

  const [board] = await db
    .select({ createdBy: boards.createdBy })
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (board && board.createdBy === memberId) {
    throw new ApiError(400, "The board creator cannot be removed from the board");
  }

  await db
    .delete(boardMembers)
    .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, memberId)));

  await db
    .delete(boardMemberPermissions)
    .where(and(eq(boardMemberPermissions.boardId, boardId), eq(boardMemberPermissions.userId, memberId)));
}
