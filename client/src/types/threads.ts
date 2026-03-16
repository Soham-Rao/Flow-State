export interface ThreadUserSummary {
  id: string;
  name: string;
  displayName: string | null;
  username: string | null;
  email: string;
  role: "admin" | "member" | "guest";
}

export interface DmConversationSummary {
  id: string;
  type: "dm";
  otherUser: ThreadUserSummary;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadMentions: number;
}

export interface ThreadReaction {
  emoji: string;
  count: number;
}

export interface ThreadAttachment {
  id: string;
  messageId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
}

export interface ThreadMessageSummary {
  id: string;
  conversationId: string;
  author: ThreadUserSummary;
  body: string | null;
  isForwarded?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reactions: ThreadReaction[];
  replyCount: number;
  attachments: ThreadAttachment[];
}

export interface ThreadReplySummary {
  id: string;
  parentMessageId: string;
  author: ThreadUserSummary;
  body: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  reactions: ThreadReaction[];
}



