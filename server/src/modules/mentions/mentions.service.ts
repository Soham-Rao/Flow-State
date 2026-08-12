import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { db } from "../../db/connection.js";
import {
  boards,
  cards,
  cardAssignees,
  commentMentions,
  comments,
  lists,
  rolePermissionsTable,
  roleScopeOverrides,
  threadConversations,
  threadMentions,
  threadMessages,
  threadReplyMentions,
  threadReplies,
  threadMembers,
  users
} from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { decryptDmBody } from "../../utils/encryption.js";
import { getUserRoleIds } from "../../utils/permissions.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";

export interface MentionUnreadCounts {
  total: number;
  threads: number;
  comments: number;
  assignments: number;
}

export interface CommentMentionDetail {
  commentId: string;
  boardId: string;
  boardName: string;
  listId: string | null;
  listName: string | null;
  cardId: string | null;
  cardTitle: string | null;
  body: string;
  createdAt: number;
}

export interface ThreadMentionDetail {
  id: string;
  mentionType: "message" | "reply";
  conversationId: string;
  conversationType: "dm" | "channel";
  conversationLabel: string;
  messageId: string;
  replyId: string | null;
  body: string | null;
  createdAt: number;
}

async function getAccessibleBoardIds(userId: string, boardIds: string[]): Promise<Set<string>> {
  if (boardIds.length === 0) {
    return new Set();
  }

  const roleIds = await getUserRoleIds(userId);
  if (roleIds.length === 0) {
    return new Set();
  }

  const permissions: Array<{ permission: string }> = await db
    .select({ permission: rolePermissionsTable.permission })
    .from(rolePermissionsTable)
    .where(inArray(rolePermissionsTable.roleId, roleIds));

  const hasGlobalView = permissions.some((row) => row.permission === "view_boards");

  const overrides: Array<{ scopeId: string; access: "allow" | "deny" }> = await db
    .select({ scopeId: roleScopeOverrides.scopeId, access: roleScopeOverrides.access })
    .from(roleScopeOverrides)
    .where(
      and(
        inArray(roleScopeOverrides.roleId, roleIds),
        eq(roleScopeOverrides.scopeType, "board"),
        eq(roleScopeOverrides.permission, "view_boards"),
        inArray(roleScopeOverrides.scopeId, boardIds)
      )
    );

  const allowed = new Set<string>();
  const denied = new Set<string>();
  for (const override of overrides) {
    if (override.access === "deny") {
      denied.add(override.scopeId);
    } else {
      allowed.add(override.scopeId);
    }
  }

  const accessible = new Set<string>();
  for (const boardId of boardIds) {
    if (denied.has(boardId)) {
      continue;
    }
    if (allowed.has(boardId) || hasGlobalView) {
      accessible.add(boardId);
    }
  }
  return accessible;
}

async function cleanupInvalidCommentMentions(userId: string): Promise<void> {
  const rows: Array<{ commentId: string; boardId: string }> = await db
    .select({ commentId: commentMentions.commentId, boardId: comments.boardId })
    .from(commentMentions)
    .innerJoin(comments, eq(commentMentions.commentId, comments.id))
    .innerJoin(boards, eq(comments.boardId, boards.id))
    .where(and(eq(commentMentions.userId, userId), eq(boards.workspaceId, getCurrentWorkspaceId())));

  if (rows.length === 0) {
    return;
  }

  const boardIds = Array.from(new Set(rows.map((row) => row.boardId)));
  const accessible = await getAccessibleBoardIds(userId, boardIds);

  if (accessible.size === boardIds.length) {
    return;
  }

  const invalidCommentIds = rows
    .filter((row) => !accessible.has(row.boardId))
    .map((row) => row.commentId);

  if (invalidCommentIds.length === 0) {
    return;
  }

  await db.delete(commentMentions)
    .where(and(eq(commentMentions.userId, userId), inArray(commentMentions.commentId, invalidCommentIds)))
    .execute();
}

async function cleanupInvalidThreadMentions(userId: string): Promise<void> {
  await db.execute(sql`
      DELETE FROM thread_mentions
      WHERE mentioned_user_id = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM thread_messages tm
          INNER JOIN thread_members m
            ON m.conversation_id = tm.conversation_id
           AND m.user_id = thread_mentions.mentioned_user_id
          WHERE tm.id = thread_mentions.message_id
        )
    `);

  await db.execute(sql`
      DELETE FROM thread_reply_mentions
      WHERE mentioned_user_id = ${userId}
        AND NOT EXISTS (
          SELECT 1
          FROM thread_replies tr
          INNER JOIN thread_messages tm ON tr.parent_message_id = tm.id
          INNER JOIN thread_members m
            ON m.conversation_id = tm.conversation_id
           AND m.user_id = thread_reply_mentions.mentioned_user_id
          WHERE tr.id = thread_reply_mentions.reply_id
        )
    `);
}

export async function getUnreadMentions(userId: string): Promise<MentionUnreadCounts> {
  await cleanupInvalidThreadMentions(userId);
  await cleanupInvalidCommentMentions(userId);
  const commentCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(commentMentions)
    .innerJoin(comments, eq(commentMentions.commentId, comments.id))
    .innerJoin(boards, eq(comments.boardId, boards.id))
    .where(
      and(
        eq(commentMentions.userId, userId),
        eq(boards.workspaceId, getCurrentWorkspaceId()),
        isNull(commentMentions.seenAt),
        ne(comments.authorId, commentMentions.userId)
      )
    );

  const threadMessageCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(threadMentions)
    .innerJoin(threadMessages, eq(threadMentions.messageId, threadMessages.id))
    .innerJoin(threadConversations, eq(threadMessages.conversationId, threadConversations.id))
    .innerJoin(threadMembers, and(eq(threadMembers.conversationId, threadMessages.conversationId), eq(threadMembers.userId, threadMentions.mentionedUserId)))
    .where(
      and(
        eq(threadMentions.mentionedUserId, userId),
        eq(threadConversations.workspaceId, getCurrentWorkspaceId()),
        eq(threadConversations.workspaceId, getCurrentWorkspaceId()),
        isNull(threadMentions.seenAt),
        ne(threadMessages.authorId, threadMentions.mentionedUserId)
      )
    );

  const threadReplyCountRows = await db
    .select({ count: sql<number>`count(*)` })
    .from(threadReplyMentions)
    .innerJoin(threadReplies, eq(threadReplyMentions.replyId, threadReplies.id))
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .innerJoin(threadConversations, eq(threadMessages.conversationId, threadConversations.id))
    .innerJoin(threadMembers, and(eq(threadMembers.conversationId, threadMessages.conversationId), eq(threadMembers.userId, threadReplyMentions.mentionedUserId)))
    .where(
      and(
        eq(threadReplyMentions.mentionedUserId, userId),
        eq(threadConversations.workspaceId, getCurrentWorkspaceId()),
        eq(threadConversations.workspaceId, getCurrentWorkspaceId()),
        isNull(threadReplyMentions.seenAt),
        ne(threadReplies.authorId, threadReplyMentions.mentionedUserId)
      )
    );

  const threads = (threadMessageCountRows[0]?.count ?? 0) + (threadReplyCountRows[0]?.count ?? 0);
  const commentTotal = commentCountRows[0]?.count ?? 0;

  const assignedBoardRows = await db
    .select({ boardId: boards.id })
    .from(cardAssignees)
    .innerJoin(cards, eq(cardAssignees.cardId, cards.id))
    .innerJoin(lists, eq(cards.listId, lists.id))
    .innerJoin(boards, eq(lists.boardId, boards.id))
    .where(and(eq(cardAssignees.userId, userId), eq(boards.workspaceId, getCurrentWorkspaceId())));

  const assignedBoardIds = Array.from(new Set(assignedBoardRows.map((row) => row.boardId)));
  const accessibleAssignedBoards = await getAccessibleBoardIds(userId, assignedBoardIds);
  const accessibleBoardIds = Array.from(accessibleAssignedBoards);

  let assignmentCount = 0;
  if (accessibleBoardIds.length > 0) {
    const assignmentCountRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(cardAssignees)
      .innerJoin(cards, eq(cardAssignees.cardId, cards.id))
      .innerJoin(lists, eq(cards.listId, lists.id))
      .innerJoin(boards, eq(lists.boardId, boards.id))
      .where(
        and(
          eq(cardAssignees.userId, userId),
          inArray(boards.id, accessibleBoardIds),
          isNull(boards.archivedAt),
          isNull(lists.archivedAt),
          ne(lists.isDoneList, true),
          isNull(cards.archivedAt)
        )
      );
    assignmentCount = assignmentCountRows[0]?.count ?? 0;
  }

  return {
    total: threads + commentTotal,
    threads,
    comments: commentTotal,
    assignments: assignmentCount
  };
}

export async function markCommentMentionsSeen(userId: string, commentIds: string[]): Promise<void> {
  if (commentIds.length === 0) {
    return;
  }

  await db.update(commentMentions)
    .set({ seenAt: new Date() })
    .where(and(eq(commentMentions.userId, userId), inArray(commentMentions.commentId, commentIds), isNull(commentMentions.seenAt)))
    .execute();
}

export async function markThreadMentionsSeen(userId: string, conversationId: string): Promise<void> {
  const membershipRows = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .innerJoin(threadConversations, eq(threadMembers.conversationId, threadConversations.id))
    .where(and(
      eq(threadMembers.conversationId, conversationId),
      eq(threadMembers.userId, userId),
      eq(threadConversations.workspaceId, getCurrentWorkspaceId())
    ))
    .limit(1);

  if (!membershipRows[0]) {
    throw new ApiError(403, "You do not have access to this conversation");
  }

  const now = new Date();
  await db.execute(sql`
      UPDATE thread_mentions
      SET seen_at = ${now}
      WHERE mentioned_user_id = ${userId}
        AND seen_at IS NULL
        AND message_id IN (SELECT id FROM thread_messages WHERE conversation_id = ${conversationId})
    `);
}

export async function markThreadMessageMentionsSeen(userId: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) {
    return;
  }

  const allowed: Array<{ id: string }> = await db
    .select({ id: threadMessages.id })
    .from(threadMessages)
    .innerJoin(
      threadMembers,
      and(eq(threadMembers.conversationId, threadMessages.conversationId), eq(threadMembers.userId, userId))
    )
    .where(inArray(threadMessages.id, messageIds));

  const allowedIds = allowed.map((row) => row.id);
  if (allowedIds.length === 0) {
    return;
  }

  await db.update(threadMentions)
    .set({ seenAt: new Date() })
    .where(and(eq(threadMentions.mentionedUserId, userId), inArray(threadMentions.messageId, allowedIds), isNull(threadMentions.seenAt)))
    .execute();
}

export async function markThreadReplyMentionIdsSeen(userId: string, replyIds: string[]): Promise<void> {
  if (replyIds.length === 0) {
    return;
  }

  const allowed: Array<{ id: string }> = await db
    .select({ id: threadReplies.id })
    .from(threadReplies)
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .innerJoin(
      threadMembers,
      and(eq(threadMembers.conversationId, threadMessages.conversationId), eq(threadMembers.userId, userId))
    )
    .where(inArray(threadReplies.id, replyIds));

  const allowedIds = allowed.map((row) => row.id);
  if (allowedIds.length === 0) {
    return;
  }

  await db.update(threadReplyMentions)
    .set({ seenAt: new Date() })
    .where(and(eq(threadReplyMentions.mentionedUserId, userId), inArray(threadReplyMentions.replyId, allowedIds), isNull(threadReplyMentions.seenAt)))
    .execute();
}

export async function markThreadReplyMentionsSeen(userId: string, parentMessageId: string): Promise<void> {
  const messageRows: Array<{ conversationId: string }> = await db
    .select({ conversationId: threadMessages.conversationId })
    .from(threadMessages)
    .where(eq(threadMessages.id, parentMessageId))
    .limit(1);

  const message = messageRows[0];

  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const membershipRows = await db
    .select({ userId: threadMembers.userId })
    .from(threadMembers)
    .where(and(eq(threadMembers.conversationId, message.conversationId), eq(threadMembers.userId, userId)))
    .limit(1);

  if (!membershipRows[0]) {
    throw new ApiError(403, "You do not have access to this conversation");
  }

  const now = new Date();
  await db.execute(sql`
      UPDATE thread_reply_mentions
      SET seen_at = ${now}
      WHERE mentioned_user_id = ${userId}
        AND seen_at IS NULL
        AND reply_id IN (
          SELECT tr.id
          FROM thread_replies tr
          WHERE tr.parent_message_id = ${parentMessageId}
        )
    `);
}

function resolveThreadPreviewBody(
  conversationType: "dm" | "channel",
  body: string | null,
  bodyEncrypted: string | null,
  encryptionVersion: number | null
): string | null {
  if (conversationType === "dm" && bodyEncrypted) {
    return decryptDmBody(bodyEncrypted, encryptionVersion ?? 1);
  }
  return body;
}

export async function listUnreadThreadMentions(userId: string): Promise<ThreadMentionDetail[]> {
  await cleanupInvalidThreadMentions(userId);

  const messageRows: Array<{
      mentionId: string;
      messageId: string;
      conversationId: string;
      conversationType: "dm" | "channel";
      conversationName: string | null;
      body: string | null;
      bodyEncrypted: string | null;
      encryptionVersion: number | null;
      createdAt: Date | number;
    }> = await db
    .select({
      mentionId: threadMentions.id,
      messageId: threadMessages.id,
      conversationId: threadConversations.id,
      conversationType: threadConversations.type,
      conversationName: threadConversations.name,
      body: threadMessages.body,
      bodyEncrypted: threadMessages.bodyEncrypted,
      encryptionVersion: threadMessages.encryptionVersion,
      createdAt: threadMessages.createdAt
    })
    .from(threadMentions)
    .innerJoin(threadMessages, eq(threadMentions.messageId, threadMessages.id))
    .innerJoin(threadConversations, eq(threadMessages.conversationId, threadConversations.id))
    .innerJoin(
      threadMembers,
      and(eq(threadMembers.conversationId, threadConversations.id), eq(threadMembers.userId, userId))
    )
    .where(
      and(
        eq(threadMentions.mentionedUserId, userId),
        isNull(threadMentions.seenAt),
        ne(threadMessages.authorId, userId)
      )
    )
    .orderBy(desc(threadMessages.createdAt))
    .limit(50);

  const replyRows: Array<{
      mentionId: string;
      replyId: string;
      messageId: string;
      conversationId: string;
      conversationType: "dm" | "channel";
      conversationName: string | null;
      body: string | null;
      bodyEncrypted: string | null;
      encryptionVersion: number | null;
      createdAt: Date | number;
    }> = await db
    .select({
      mentionId: threadReplyMentions.id,
      replyId: threadReplies.id,
      messageId: threadReplies.parentMessageId,
      conversationId: threadConversations.id,
      conversationType: threadConversations.type,
      conversationName: threadConversations.name,
      body: threadReplies.body,
      bodyEncrypted: threadReplies.bodyEncrypted,
      encryptionVersion: threadReplies.encryptionVersion,
      createdAt: threadReplies.createdAt
    })
    .from(threadReplyMentions)
    .innerJoin(threadReplies, eq(threadReplyMentions.replyId, threadReplies.id))
    .innerJoin(threadMessages, eq(threadReplies.parentMessageId, threadMessages.id))
    .innerJoin(threadConversations, eq(threadMessages.conversationId, threadConversations.id))
    .innerJoin(
      threadMembers,
      and(eq(threadMembers.conversationId, threadConversations.id), eq(threadMembers.userId, userId))
    )
    .where(
      and(
        eq(threadReplyMentions.mentionedUserId, userId),
        isNull(threadReplyMentions.seenAt),
        ne(threadReplies.authorId, userId)
      )
    )
    .orderBy(desc(threadReplies.createdAt))
    .limit(50);

  const dmConversationIds = Array.from(
    new Set(
      [...messageRows, ...replyRows]
        .filter((row) => row.conversationType === "dm")
        .map((row) => row.conversationId)
    )
  );

  const dmUsers: Array<{
          conversationId: string;
          id: string;
          name: string;
          displayName: string | null;
          username: string | null;
          email: string;
        }> = dmConversationIds.length
    ? await db
        .select({
          conversationId: threadMembers.conversationId,
          id: users.id,
          name: users.name,
          displayName: users.displayName,
          username: users.username,
          email: users.email
        })
        .from(threadMembers)
        .innerJoin(users, eq(threadMembers.userId, users.id))
        .where(
          and(
            inArray(threadMembers.conversationId, dmConversationIds),
            ne(threadMembers.userId, userId)
          )
        )
    : [];

  const dmLabelMap = new Map<string, string>();
  dmUsers.forEach((row) => {
    const label = row.displayName ?? row.name ?? row.username ?? row.email;
    dmLabelMap.set(row.conversationId, label);
  });

  const messageMentions = messageRows.map((row) => ({
    id: row.mentionId,
    mentionType: "message" as const,
    conversationId: row.conversationId,
    conversationType: row.conversationType,
    conversationLabel:
      row.conversationType === "channel"
        ? row.conversationName ?? "Channel"
        : dmLabelMap.get(row.conversationId) ?? "Direct message",
    messageId: row.messageId,
    replyId: null,
    body: resolveThreadPreviewBody(row.conversationType, row.body, row.bodyEncrypted, row.encryptionVersion),
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime()
  }));

  const replyMentions = replyRows.map((row) => ({
    id: row.mentionId,
    mentionType: "reply" as const,
    conversationId: row.conversationId,
    conversationType: row.conversationType,
    conversationLabel:
      row.conversationType === "channel"
        ? row.conversationName ?? "Channel"
        : dmLabelMap.get(row.conversationId) ?? "Direct message",
    messageId: row.messageId,
    replyId: row.replyId,
    body: resolveThreadPreviewBody(row.conversationType, row.body, row.bodyEncrypted, row.encryptionVersion),
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime()
  }));

  return [...messageMentions, ...replyMentions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
}

export async function listUnreadCommentMentions(userId: string): Promise<CommentMentionDetail[]> {
  await cleanupInvalidCommentMentions(userId);
  const rows: Array<{
    commentId: string;
    boardId: string;
    boardName: string;
    listId: string | null;
    listName: string | null;
    cardId: string | null;
    cardTitle: string | null;
    body: string;
    createdAt: Date | number;
  }> = await db
    .select({
      commentId: commentMentions.commentId,
      boardId: comments.boardId,
      boardName: boards.name,
      listId: comments.listId,
      listName: lists.name,
      cardId: comments.cardId,
      cardTitle: cards.title,
      body: comments.body,
      createdAt: comments.createdAt
    })
    .from(commentMentions)
    .innerJoin(comments, eq(commentMentions.commentId, comments.id))
    .innerJoin(boards, eq(comments.boardId, boards.id))
    .leftJoin(lists, eq(comments.listId, lists.id))
    .leftJoin(cards, eq(comments.cardId, cards.id))
    .where(
      and(
        eq(commentMentions.userId, userId),
        eq(boards.workspaceId, getCurrentWorkspaceId()),
        isNull(commentMentions.seenAt),
        ne(comments.authorId, userId)
      )
    )
    .orderBy(desc(comments.createdAt))
    .limit(50);

  return rows.map((row) => ({
    ...row,
    createdAt: typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime()
  }));
}

export async function listCommentMentions(userId: string): Promise<Array<{ commentId: string }>> {
  await cleanupInvalidCommentMentions(userId);
  return db
    .select({ commentId: commentMentions.commentId })
    .from(commentMentions)
    .innerJoin(comments, eq(commentMentions.commentId, comments.id))
    .innerJoin(boards, eq(comments.boardId, boards.id))
    .where(and(
      eq(commentMentions.userId, userId),
      eq(boards.workspaceId, getCurrentWorkspaceId()),
      isNull(commentMentions.seenAt)
    ));
}






