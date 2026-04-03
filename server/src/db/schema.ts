import { relations } from "drizzle-orm";
import {
  boolean,
  char,
  datetime,
  foreignKey,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

export const userRoles = ["admin", "member", "guest"] as const;
export const rolePermissions = [
  "manage_workspace",
  "manage_roles",
  "invite_users",
  "remove_users",
  "view_activity_logs",
  "view_boards",
  "create_boards",
  "edit_boards",
  "delete_boards",
  "manage_lists",
  "create_cards",
  "edit_cards",
  "delete_cards_any",
  "delete_cards_own",
  "assign_members",
  "set_due_dates",
  "manage_checklists",
  "upload_files",
  "manage_labels",
  "comment",
  "edit_comments",
  "delete_comments",
  "react",
  "mention_users",
  "mention_roles",
  "view_threads",
  "create_threads",
  "reply_threads",
  "delete_threads",
  "pin_threads",
  "dm_read",
  "dm_write",
  "dm_encrypt",
  "channel_read",
  "channel_write",
  "channel_edit",
  "channel_members_add",
  "channel_members_remove",
  "channel_manage_overrides",
  "channel_delete",
  "view_settings",
  "send_announcements"
] as const;
export const roleScopeTypes = ["global", "board", "section", "card"] as const;
export const roleScopeAccess = ["allow", "deny"] as const;
export const threadConversationTypes = ["dm", "channel"] as const;
export const threadMemberRoles = ["member", "admin"] as const;
export const cardPriorities = ["low", "medium", "high", "urgent"] as const;
export const retentionModes = ["attachments_only", "card_and_attachments"] as const;
export const labelColors = [
  "slate",
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "purple",
  "pink"
] as const;
export const cardCoverColors = [
  "none",
  "slate",
  "blue",
  "teal",
  "green",
  "amber",
  "orange",
  "red",
  "purple",
  "pink"
] as const;

type TableColumns = Record<string, any>;

const createdAt = (name: string) => datetime(name, { mode: "date", fsp: 3 });

export const users = mysqlTable("users", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  displayName: varchar("display_name", { length: 255 }),
  bio: text("bio"),
  age: int("age"),
  dateOfBirth: datetime("date_of_birth", { mode: "date", fsp: 3 }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", userRoles).notNull().default("guest"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  usernameUnique: uniqueIndex("idx_users_username_unique").on(table.username)
}));

export const invites = mysqlTable("invites", {
  id: char("id", { length: 36 }).primaryKey(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }),
  role: mysqlEnum("role", userRoles).notNull().default("guest"),
  createdBy: char("created_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  acceptedBy: char("accepted_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  acceptedAt: createdAt("accepted_at"),
  revokedAt: createdAt("revoked_at"),
  expiresAt: createdAt("expires_at").notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  emailIdx: index("idx_invites_email").on(table.email),
  expiresAtIdx: index("idx_invites_expires_at").on(table.expiresAt)
}));

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: char("id", { length: 36 }).primaryKey(),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  expiresAt: createdAt("expires_at").notNull(),
  consumedAt: createdAt("consumed_at"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  userIdIdx: index("idx_password_reset_tokens_user_id").on(table.userId),
  expiresAtIdx: index("idx_password_reset_tokens_expires_at").on(table.expiresAt)
}));

export const auditLogs = mysqlTable("audit_logs", {
  id: char("id", { length: 36 }).primaryKey(),
  actorId: char("actor_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  targetType: varchar("target_type", { length: 64 }),
  targetId: varchar("target_id", { length: 255 }),
  ip: varchar("ip", { length: 128 }),
  userAgent: varchar("user_agent", { length: 512 }),
  requestId: varchar("request_id", { length: 255 }),
  metadata: text("metadata"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  actorIdx: index("idx_audit_logs_actor_id").on(table.actorId),
  actionIdx: index("idx_audit_logs_action").on(table.action),
  createdAtIdx: index("idx_audit_logs_created_at").on(table.createdAt)
}));

export const roles = mysqlTable("roles", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  color: varchar("color", { length: 32 }).notNull(),
  priority: int("priority").notNull().default(1),
  mentionable: boolean("mentionable").notNull().default(false),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  priorityIdx: index("idx_roles_priority").on(table.priority)
}));

export const rolePermissionsTable = mysqlTable("role_permissions", {
  roleId: char("role_id", { length: 36 })
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  permission: mysqlEnum("permission", rolePermissions).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.roleId, table.permission] }),
  roleIdIdx: index("idx_role_permissions_role_id").on(table.roleId)
}));

export const userRoleAssignments = mysqlTable("user_roles", {
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: char("role_id", { length: 36 })
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
  userIdIdx: index("idx_user_roles_user_id").on(table.userId),
  roleIdIdx: index("idx_user_roles_role_id").on(table.roleId)
}));

export const inviteRoleAssignments = mysqlTable("invite_roles", {
  inviteId: char("invite_id", { length: 36 })
    .notNull()
    .references(() => invites.id, { onDelete: "cascade" }),
  roleId: char("role_id", { length: 36 })
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.inviteId, table.roleId] }),
  inviteIdIdx: index("idx_invite_roles_invite_id").on(table.inviteId),
  roleIdIdx: index("idx_invite_roles_role_id").on(table.roleId)
}));

export const roleScopeOverrides = mysqlTable("role_scope_overrides", {
  roleId: char("role_id", { length: 36 })
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  scopeType: mysqlEnum("scope_type", roleScopeTypes).notNull(),
  scopeId: char("scope_id", { length: 36 }).notNull(),
  permission: mysqlEnum("permission", rolePermissions).notNull(),
  access: mysqlEnum("access", roleScopeAccess).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.roleId, table.scopeType, table.scopeId, table.permission] }),
  roleIdIdx: index("idx_role_scope_overrides_role_id").on(table.roleId)
}));

export const boards = mysqlTable("boards", {
  id: char("id", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  background: varchar("background", { length: 255 }).notNull().default("teal-gradient"),
  retentionMode: mysqlEnum("retention_mode", retentionModes)
    .notNull()
    .default("card_and_attachments"),
  retentionMinutes: int("retention_minutes").notNull().default(7 * 24 * 60),
  archiveRetentionMinutes: int("archive_retention_minutes").notNull().default(7 * 24 * 60),
  archivedAt: createdAt("archived_at"),
  createdBy: char("created_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  nameUnique: uniqueIndex("idx_boards_name_unique").on(table.name)
}));

export const lists = mysqlTable("lists", {
  id: char("id", { length: 36 }).primaryKey(),
  boardId: char("board_id", { length: 36 })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  position: int("position").notNull().default(0),
  isDoneList: boolean("is_done_list").notNull().default(false),
  archivedAt: createdAt("archived_at"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  boardIdIdx: index("idx_lists_board_id").on(table.boardId),
  boardNameActiveUnique: uniqueIndex("idx_lists_board_name_active").on(table.boardId, table.name, table.archivedAt)
}));

export const cards = mysqlTable("cards", {
  id: char("id", { length: 36 }).primaryKey(),
  listId: char("list_id", { length: 36 })
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", cardPriorities).notNull().default("medium"),
  coverColor: mysqlEnum("cover_color", cardCoverColors),
  dueDate: createdAt("due_date"),
  position: int("position").notNull().default(0),
  createdBy: char("created_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  archivedAt: createdAt("archived_at"),
  doneEnteredAt: createdAt("done_entered_at"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  listIdIdx: index("idx_cards_list_id").on(table.listId),
  doneEnteredAtIdx: index("idx_cards_done_entered_at").on(table.doneEnteredAt)
}));

export const checklists = mysqlTable("checklists", {
  id: char("id", { length: 36 }).primaryKey(),
  cardId: char("card_id", { length: 36 })
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  position: int("position").notNull().default(0),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  cardIdIdx: index("idx_checklists_card_id").on(table.cardId)
}));

export const checklistItems = mysqlTable("checklist_items", {
  id: char("id", { length: 36 }).primaryKey(),
  checklistId: char("checklist_id", { length: 36 })
    .notNull()
    .references(() => checklists.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  isDone: boolean("is_done").notNull().default(false),
  position: int("position").notNull().default(0),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  checklistIdIdx: index("idx_checklist_items_checklist_id").on(table.checklistId)
}));

export const labels = mysqlTable("labels", {
  id: char("id", { length: 36 }).primaryKey(),
  boardId: char("board_id", { length: 36 })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  color: mysqlEnum("color", labelColors).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  boardIdIdx: index("idx_labels_board_id").on(table.boardId)
}));

export const cardLabels = mysqlTable("card_labels", {
  cardId: char("card_id", { length: 36 })
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  labelId: char("label_id", { length: 36 })
    .notNull()
    .references(() => labels.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.cardId, table.labelId] }),
  cardIdIdx: index("idx_card_labels_card_id").on(table.cardId),
  labelIdIdx: index("idx_card_labels_label_id").on(table.labelId)
}));

export const cardAssignees = mysqlTable("card_assignees", {
  cardId: char("card_id", { length: 36 })
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.cardId, table.userId] }),
  cardIdIdx: index("idx_card_assignees_card_id").on(table.cardId),
  userIdIdx: index("idx_card_assignees_user_id").on(table.userId)
}));

export const attachments = mysqlTable("attachments", {
  id: char("id", { length: 36 }).primaryKey(),
  cardId: char("card_id", { length: 36 })
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storedName: varchar("stored_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }),
  size: int("size").notNull().default(0),
  storagePath: varchar("storage_path", { length: 1024 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  cardIdIdx: index("idx_attachments_card_id").on(table.cardId)
}));

export const comments = mysqlTable("comments", {
  id: char("id", { length: 36 }).primaryKey(),
  boardId: char("board_id", { length: 36 })
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  listId: char("list_id", { length: 36 }).references(() => lists.id, { onDelete: "cascade" }),
  cardId: char("card_id", { length: 36 }).references(() => cards.id, { onDelete: "cascade" }),
  authorId: char("author_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  boardIdIdx: index("idx_comments_board_id").on(table.boardId),
  listIdIdx: index("idx_comments_list_id").on(table.listId),
  cardIdIdx: index("idx_comments_card_id").on(table.cardId)
}));

export const commentReactions = mysqlTable("comment_reactions", {
  commentId: char("comment_id", { length: 36 })
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 64 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.commentId, table.userId, table.emoji] })
}));

export const commentMentions = mysqlTable("comment_mentions", {
  commentId: char("comment_id", { length: 36 })
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  seenAt: createdAt("seen_at")
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.commentId, table.userId] }),
  userIdIdx: index("idx_comment_mentions_user_id").on(table.userId)
}));

export const announcements = mysqlTable("announcements", {
  id: char("id", { length: 36 }).primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(),
  body: text("body").notNull(),
  audience: text("audience"),
  createdBy: char("created_by", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
});

export const announcementRecipients = mysqlTable("announcement_recipients", {
  announcementId: char("announcement_id", { length: 36 })
    .notNull()
    .references(() => announcements.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  seenAt: createdAt("seen_at")
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.announcementId, table.userId] })
}));

export const threadConversations = mysqlTable("thread_conversations", {
  id: char("id", { length: 36 }).primaryKey(),
  type: mysqlEnum("type", threadConversationTypes).notNull(),
  name: varchar("name", { length: 255 }),
  description: text("description"),
  createdBy: char("created_by", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date()),
  lastMessageAt: createdAt("last_message_at")
}, (table: TableColumns) => ({
  lastMessageIdx: index("idx_thread_conversations_last_message_at").on(table.lastMessageAt)
}));

export const threadMembers = mysqlTable("thread_members", {
  conversationId: char("conversation_id", { length: 36 }).notNull(),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", threadMemberRoles).notNull().default("member"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  lastReadAt: createdAt("last_read_at")
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.conversationId, table.userId] }),
  conversationIdx: index("idx_thread_members_conversation_id").on(table.conversationId),
  userIdx: index("idx_thread_members_user_id").on(table.userId),
  lastReadIdx: index("idx_thread_members_last_read_at").on(table.lastReadAt)
}));

export const threadMemberPermissions = mysqlTable("thread_member_permissions", {
  conversationId: char("conversation_id", { length: 36 }).notNull(),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  permission: mysqlEnum("permission", rolePermissions).notNull(),
  access: mysqlEnum("access", roleScopeAccess).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.conversationId, table.userId, table.permission] }),
  conversationIdx: index("idx_thread_member_permissions_conversation_id").on(table.conversationId),
  userIdx: index("idx_thread_member_permissions_user_id").on(table.userId),
  conversationFk: foreignKey({
    name: "fk_thread_member_permissions_conv",
    columns: [table.conversationId],
    foreignColumns: [threadConversations.id]
  }).onDelete("cascade")
}));

export const threadMessages = mysqlTable("thread_messages", {
  id: char("id", { length: 36 }).primaryKey(),
  conversationId: char("conversation_id", { length: 36 }).notNull(),
  authorId: char("author_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  replyToMessageId: char("reply_to_message_id", { length: 36 }),
  replyToReplyId: char("reply_to_reply_id", { length: 36 }),
  body: text("body"),
  bodyEncrypted: text("body_encrypted"),
  bodyFormat: varchar("body_format", { length: 32 }).notNull().default("plain"),
  encryptionVersion: int("encryption_version").notNull().default(1),
  isForwarded: boolean("is_forwarded").notNull().default(false),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date()),
  deletedAt: createdAt("deleted_at")
}, (table: TableColumns) => ({
  conversationIdx: index("idx_thread_messages_conversation_id").on(table.conversationId),
  authorIdx: index("idx_thread_messages_author_id").on(table.authorId),
  createdAtIdx: index("idx_thread_messages_created_at").on(table.createdAt),
  replyToMessageIdx: index("idx_thread_messages_reply_to_message").on(table.replyToMessageId),
  replyToReplyIdx: index("idx_thread_messages_reply_to_reply").on(table.replyToReplyId),
  replyToMessageFk: foreignKey({
    name: "fk_thread_messages_reply_to_message",
    columns: [table.replyToMessageId],
    foreignColumns: [table.id]
  }).onDelete("set null"),
}));

export const threadReplies = mysqlTable("thread_replies", {
  id: char("id", { length: 36 }).primaryKey(),
  parentMessageId: char("parent_message_id", { length: 36 })
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  authorId: char("author_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body"),
  bodyEncrypted: text("body_encrypted"),
  bodyFormat: varchar("body_format", { length: 32 }).notNull().default("plain"),
  encryptionVersion: int("encryption_version").notNull().default(1),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  updatedAt: createdAt("updated_at").notNull().$defaultFn(() => new Date()),
  deletedAt: createdAt("deleted_at")
}, (table: TableColumns) => ({
  parentMessageIdx: index("idx_thread_replies_parent_message_id").on(table.parentMessageId)
}));

export const threadReplyAttachments = mysqlTable("thread_reply_attachments", {
  id: char("id", { length: 36 }).primaryKey(),
  replyId: char("reply_id", { length: 36 })
    .notNull()
    .references(() => threadReplies.id, { onDelete: "cascade" }),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }),
  size: int("size").notNull().default(0),
  storagePath: varchar("storage_path", { length: 1024 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
});

export const threadReplyVoiceNotes = mysqlTable("thread_reply_voice_notes", {
  id: char("id", { length: 36 }).primaryKey(),
  replyId: char("reply_id", { length: 36 })
    .notNull()
    .references(() => threadReplies.id, { onDelete: "cascade" }),
  durationSec: int("duration_sec").notNull().default(0),
  storagePath: varchar("storage_path", { length: 1024 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
});

export const threadAttachments = mysqlTable("thread_attachments", {
  id: char("id", { length: 36 }).primaryKey(),
  messageId: char("message_id", { length: 36 })
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 255 }),
  size: int("size").notNull().default(0),
  storagePath: varchar("storage_path", { length: 1024 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
});

export const threadVoiceNotes = mysqlTable("thread_voice_notes", {
  id: char("id", { length: 36 }).primaryKey(),
  messageId: char("message_id", { length: 36 })
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  durationSec: int("duration_sec").notNull().default(0),
  storagePath: varchar("storage_path", { length: 1024 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
});

export const threadMentions = mysqlTable("thread_mentions", {
  id: char("id", { length: 36 }).primaryKey(),
  messageId: char("message_id", { length: 36 })
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  mentionedUserId: char("mentioned_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  seenAt: createdAt("seen_at")
}, (table: TableColumns) => ({
  userIdx: index("idx_thread_mentions_user_id").on(table.mentionedUserId)
}));

export const threadReplyMentions = mysqlTable("thread_reply_mentions", {
  id: char("id", { length: 36 }).primaryKey(),
  replyId: char("reply_id", { length: 36 })
    .notNull()
    .references(() => threadReplies.id, { onDelete: "cascade" }),
  mentionedUserId: char("mentioned_user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date()),
  seenAt: createdAt("seen_at")
}, (table: TableColumns) => ({
  userIdx: index("idx_thread_reply_mentions_user_id").on(table.mentionedUserId)
}));

export const threadMessageDeletions = mysqlTable("thread_message_deletions", {
  messageId: char("message_id", { length: 36 })
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deletedAt: createdAt("deleted_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.messageId, table.userId] }),
  messageIdx: index("idx_thread_message_deletions_message_id").on(table.messageId),
  userIdx: index("idx_thread_message_deletions_user_id").on(table.userId)
}));

export const threadReplyDeletions = mysqlTable("thread_reply_deletions", {
  replyId: char("reply_id", { length: 36 })
    .notNull()
    .references(() => threadReplies.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deletedAt: createdAt("deleted_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.replyId, table.userId] }),
  replyIdx: index("idx_thread_reply_deletions_reply_id").on(table.replyId),
  userIdx: index("idx_thread_reply_deletions_user_id").on(table.userId)
}));

export const threadMessageReactions = mysqlTable("thread_message_reactions", {
  messageId: char("message_id", { length: 36 })
    .notNull()
    .references(() => threadMessages.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 64 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
  messageIdx: index("idx_thread_message_reactions_message_id").on(table.messageId)
}));

export const threadReplyReactions = mysqlTable("thread_reply_reactions", {
  replyId: char("reply_id", { length: 36 })
    .notNull()
    .references(() => threadReplies.id, { onDelete: "cascade" }),
  userId: char("user_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 64 }).notNull(),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  pk: primaryKey({ columns: [table.replyId, table.userId, table.emoji] }),
  replyIdx: index("idx_thread_reply_reactions_reply_id").on(table.replyId)
}));

export const activityLogs = mysqlTable("activity_logs", {
  id: char("id", { length: 36 }).primaryKey(),
  type: varchar("type", { length: 255 }).notNull(),
  actorId: char("actor_id", { length: 36 })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  boardId: char("board_id", { length: 36 }).references(() => boards.id, { onDelete: "set null" }),
  listId: char("list_id", { length: 36 }).references(() => lists.id, { onDelete: "set null" }),
  cardId: char("card_id", { length: 36 }).references(() => cards.id, { onDelete: "set null" }),
  threadConversationId: char("thread_conversation_id", { length: 36 }).references(() => threadConversations.id, { onDelete: "set null" }),
  threadMessageId: char("thread_message_id", { length: 36 }).references(() => threadMessages.id, { onDelete: "set null" }),
  threadReplyId: char("thread_reply_id", { length: 36 }).references(() => threadReplies.id, { onDelete: "set null" }),
  mentionedUserId: char("mentioned_user_id", { length: 36 }).references(() => users.id, { onDelete: "set null" }),
  metadata: text("metadata"),
  createdAt: createdAt("created_at").notNull().$defaultFn(() => new Date())
}, (table: TableColumns) => ({
  boardIdx: index("idx_activity_logs_board_id").on(table.boardId),
  actorIdx: index("idx_activity_logs_actor_id").on(table.actorId),
  createdAtIdx: index("idx_activity_logs_created_at").on(table.createdAt),
  threadConversationIdx: index("idx_activity_logs_thread_conversation_id").on(table.threadConversationId)
}));

export const usersRelations = relations(users, ({ many }) => ({
  boards: many(boards),
  cards: many(cards)
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  creator: one(users, {
    fields: [boards.createdBy],
    references: [users.id]
  }),
  lists: many(lists)
}));

export const listsRelations = relations(lists, ({ one, many }) => ({
  board: one(boards, {
    fields: [lists.boardId],
    references: [boards.id]
  }),
  cards: many(cards)
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  list: one(lists, {
    fields: [cards.listId],
    references: [lists.id]
  }),
  creator: one(users, {
    fields: [cards.createdBy],
    references: [users.id]
  }),
  checklists: many(checklists),
  attachments: many(attachments)
}));

export const checklistsRelations = relations(checklists, ({ one, many }) => ({
  card: one(cards, {
    fields: [checklists.cardId],
    references: [cards.id]
  }),
  items: many(checklistItems)
}));

export const checklistItemsRelations = relations(checklistItems, ({ one }) => ({
  checklist: one(checklists, {
    fields: [checklistItems.checklistId],
    references: [checklists.id]
  })
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  card: one(cards, {
    fields: [attachments.cardId],
    references: [cards.id]
  })
}));

export type UserRole = (typeof userRoles)[number];
export type RolePermission = (typeof rolePermissions)[number];
export type RoleScopeType = (typeof roleScopeTypes)[number];
export type RoleScopeAccess = (typeof roleScopeAccess)[number];
export type ThreadConversationType = (typeof threadConversationTypes)[number];
export type ThreadMemberRole = (typeof threadMemberRoles)[number];
export type RetentionMode = (typeof retentionModes)[number];
export type LabelColor = (typeof labelColors)[number];
export type CardCoverColor = (typeof cardCoverColors)[number];











