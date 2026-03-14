import { relations } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
  "view_settings"
] as const;
export const roleScopeTypes = ["global", "board", "section", "card"] as const;
export const roleScopeAccess = ["allow", "deny"] as const;
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

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  username: text("username").unique(),
  displayName: text("display_name"),
  bio: text("bio"),
  age: integer("age"),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp_ms" }),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("guest"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  email: text("email"),
  role: text("role", { enum: userRoles }).notNull().default("guest"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: integer("accepted_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});


export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").notNull(),
  priority: integer("priority").notNull().default(1),
  mentionable: integer("mentionable", { mode: "boolean" }).notNull().default(false),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const rolePermissionsTable = sqliteTable("role_permissions", {
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  permission: text("permission", { enum: rolePermissions }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permission] })
}));

export const userRoleAssignments = sqliteTable("user_roles", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] })
}));

export const inviteRoleAssignments = sqliteTable("invite_roles", {
  inviteId: text("invite_id")
    .notNull()
    .references(() => invites.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.inviteId, table.roleId] })
}));

export const roleScopeOverrides = sqliteTable("role_scope_overrides", {
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  scopeType: text("scope_type", { enum: roleScopeTypes }).notNull(),
  scopeId: text("scope_id").notNull(),
  permission: text("permission", { enum: rolePermissions }).notNull(),
  access: text("access", { enum: roleScopeAccess }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.scopeType, table.scopeId, table.permission] })
}));
export const boards = sqliteTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  background: text("background").notNull().default("teal-gradient"),
  retentionMode: text("retention_mode", { enum: retentionModes })
    .notNull()
    .default("card_and_attachments"),
  retentionMinutes: integer("retention_minutes").notNull().default(7 * 24 * 60),
  archiveRetentionMinutes: integer("archive_retention_minutes").notNull().default(7 * 24 * 60),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const lists = sqliteTable("lists", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  isDoneList: integer("is_done_list", { mode: "boolean" }).notNull().default(false),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  listId: text("list_id")
    .notNull()
    .references(() => lists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority", { enum: cardPriorities }).notNull().default("medium"),
  coverColor: text("cover_color", { enum: cardCoverColors }),
  dueDate: integer("due_date", { mode: "timestamp_ms" }),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  doneEnteredAt: integer("done_entered_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});
export const checklists = sqliteTable("checklists", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const checklistItems = sqliteTable("checklist_items", {
  id: text("id").primaryKey(),
  checklistId: text("checklist_id")
    .notNull()
    .references(() => checklists.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  isDone: integer("is_done", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const labels = sqliteTable("labels", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color", { enum: labelColors }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const cardLabels = sqliteTable("card_labels", {
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  labelId: text("label_id")
    .notNull()
    .references(() => labels.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.cardId, table.labelId] })
}));

export const cardAssignees = sqliteTable("card_assignees", {
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.cardId, table.userId] })
}));


export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type"),
  size: integer("size").notNull().default(0),
  storagePath: text("storage_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});


export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  listId: text("list_id").references(() => lists.id, { onDelete: "cascade" }),
  cardId: text("card_id").references(() => cards.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
});

export const commentReactions = sqliteTable("comment_reactions", {
  commentId: text("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.commentId, table.userId, table.emoji] })
}));

export const commentMentions = sqliteTable("comment_mentions", {
  commentId: text("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, (table) => ({
  pk: primaryKey({ columns: [table.commentId, table.userId] })
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
export type RetentionMode = (typeof retentionModes)[number];
export type LabelColor = (typeof labelColors)[number];
export type CardCoverColor = (typeof cardCoverColors)[number];



