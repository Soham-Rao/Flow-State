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
  createdAt: string;
}
