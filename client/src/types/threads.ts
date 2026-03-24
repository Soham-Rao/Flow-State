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

export interface ThreadPermissionOverride {
  permission: "dm_read" | "dm_write" | "channel_read" | "channel_write" | "channel_edit" | "channel_members_add" | "channel_members_remove" | "channel_manage_overrides" | "channel_delete";
  access: "allow" | "deny";
}

export interface ChannelConversationSummary {
  id: string;
  type: "channel";
  name: string;
  description: string | null;
  createdById: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadMentions: number;
  memberCount: number;
}

export interface ChannelMemberSummary {
  user: ThreadUserSummary;
  role: "member" | "admin";
  overrides: ThreadPermissionOverride[];
  effectivePermissions: {
    channel_read: boolean;
    channel_write: boolean;
    channel_edit: boolean;
    channel_members_add: boolean;
    channel_members_remove: boolean;
    channel_manage_overrides: boolean;
    channel_delete: boolean;
  };
}
export interface ThreadReaction {
  emoji: string;
  count: number;
}

export interface ThreadPermissionOverride {
  permission: "dm_read" | "dm_write" | "channel_read" | "channel_write" | "channel_edit" | "channel_members_add" | "channel_members_remove" | "channel_manage_overrides" | "channel_delete";
  access: "allow" | "deny";
}

export interface ChannelConversationSummary {
  id: string;
  type: "channel";
  name: string;
  description: string | null;
  createdById: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadMentions: number;
  memberCount: number;
}

export interface ChannelMemberSummary {
  user: ThreadUserSummary;
  role: "member" | "admin";
  overrides: ThreadPermissionOverride[];
  effectivePermissions: {
    channel_read: boolean;
    channel_write: boolean;
    channel_edit: boolean;
    channel_members_add: boolean;
    channel_members_remove: boolean;
    channel_manage_overrides: boolean;
    channel_delete: boolean;
  };
}
export interface ThreadReactionDetail {
  emoji: string;
  users: ThreadUserSummary[];
}

export interface ThreadReplyAttachment {
  id: string;
  replyId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
}

export interface ThreadReplyVoiceNote {
  id: string;
  replyId: string;
  durationSec: number;
  createdAt: string;
}


export interface ThreadAttachment {
  id: string;
  messageId: string;
  originalName: string;
  mimeType: string | null;
  size: number;
  createdAt: string;
}


export interface ThreadVoiceNote {
  id: string;
  messageId: string;
  durationSec: number;
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
  voiceNote: ThreadVoiceNote | null;
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
  attachments: ThreadReplyAttachment[];
  voiceNote: ThreadReplyVoiceNote | null;
}
export interface ThreadDeleteResult {
  id: string;
  scope: "me" | "all";
  message?: ThreadMessageSummary;
}



