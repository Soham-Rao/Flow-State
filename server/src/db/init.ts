import crypto from "node:crypto";

import { rolePermissions } from "./schema.js";
import { sqlite } from "./connection.js";

const ADMIN_ROLE_NAME = "Admin";
const MEMBER_ROLE_NAME = "Member";
const GUEST_ROLE_NAME = "Guest";
const ADMIN_ROLE_PRIORITY = 100;
const MEMBER_ROLE_PRIORITY = 50;
const GUEST_ROLE_PRIORITY = 1;
const ADMIN_ROLE_COLOR = "#ef4444";
const MEMBER_ROLE_COLOR = "#64748b";
const GUEST_ROLE_COLOR = "#94a3b8";

const MEMBER_ROLE_PERMISSIONS = [
  "view_boards",
  "create_boards",
  "edit_boards",
  "manage_lists",
  "create_cards",
  "edit_cards",
  "delete_cards_own",
  "assign_members",
  "set_due_dates",
  "manage_checklists",
  "upload_files",
  "manage_labels",
  "comment",
  "edit_comments",
  "react",
  "mention_users",
  "view_threads",
  "create_threads",
  "reply_threads",
  "dm_read",
  "dm_write",
  "dm_encrypt",
  "view_settings"
];

const GUEST_ROLE_PERMISSIONS = [
  "view_boards",
  "dm_read",
  "dm_write"
];

function ensureDefaultRoles(): { adminRoleId: string; memberRoleId: string; guestRoleId: string } {
  return sqlite.transaction(() => {
    const now = Date.now();
    const existingRoles = sqlite.prepare("SELECT id, name FROM roles").all() as Array<{ id: string; name: string }>;
    let adminRoleId = existingRoles.find((role) => role.name === ADMIN_ROLE_NAME)?.id;
    let memberRoleId = existingRoles.find((role) => role.name === MEMBER_ROLE_NAME)?.id;
    let guestRoleId = existingRoles.find((role) => role.name === GUEST_ROLE_NAME)?.id;

    if (!adminRoleId) {
      adminRoleId = crypto.randomUUID();
      sqlite.prepare("INSERT INTO roles (id, name, color, priority, mentionable, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(adminRoleId, ADMIN_ROLE_NAME, ADMIN_ROLE_COLOR, ADMIN_ROLE_PRIORITY, 0, 1, now, now);
    }

    if (!memberRoleId) {
      memberRoleId = crypto.randomUUID();
      sqlite.prepare("INSERT INTO roles (id, name, color, priority, mentionable, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(memberRoleId, MEMBER_ROLE_NAME, MEMBER_ROLE_COLOR, MEMBER_ROLE_PRIORITY, 0, 1, now, now);
    }

    if (!guestRoleId) {
      guestRoleId = crypto.randomUUID();
      sqlite.prepare("INSERT INTO roles (id, name, color, priority, mentionable, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(guestRoleId, GUEST_ROLE_NAME, GUEST_ROLE_COLOR, GUEST_ROLE_PRIORITY, 0, 1, now, now);
    }

    const insertPermission = sqlite.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission, created_at) VALUES (?, ?, ?)");
    for (const permission of rolePermissions) {
      insertPermission.run(adminRoleId, permission, now);
    }
    for (const permission of MEMBER_ROLE_PERMISSIONS) {
      insertPermission.run(memberRoleId, permission, now);
    }
    for (const permission of GUEST_ROLE_PERMISSIONS) {
      insertPermission.run(guestRoleId, permission, now);
    }

    return { adminRoleId, memberRoleId, guestRoleId };
  })();
}
function ensureUserRoleAssignments(adminRoleId: string, memberRoleId: string, guestRoleId: string): void {
  sqlite.transaction(() => {
    const usersRows = sqlite.prepare("SELECT id, role FROM users").all() as Array<{ id: string; role: string }>;
    const roleByLegacy: Record<string, string> = { admin: adminRoleId, member: memberRoleId, guest: guestRoleId };
    const insertUserRole = sqlite.prepare("INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, ?)");

    for (const user of usersRows) {
      const roleId = roleByLegacy[user.role] ?? guestRoleId;
      insertUserRole.run(user.id, roleId, Date.now());
    }
  })();
}

function ensureInviteRoleAssignments(adminRoleId: string, memberRoleId: string, guestRoleId: string): void {
  sqlite.transaction(() => {
    const inviteRows = sqlite.prepare("SELECT id, role FROM invites").all() as Array<{ id: string; role: string }>;
    const roleByLegacy: Record<string, string> = { admin: adminRoleId, member: memberRoleId, guest: guestRoleId };
    const insertInviteRole = sqlite.prepare("INSERT OR IGNORE INTO invite_roles (invite_id, role_id, created_at) VALUES (?, ?, ?)");

    for (const invite of inviteRows) {
      const roleId = roleByLegacy[invite.role] ?? guestRoleId;
      insertInviteRole.run(invite.id, roleId, Date.now());
    }
  })();
}
function tableAllowsGuest(tableName: string): boolean {
  const row = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as { sql?: string };
  if (!row?.sql) return true;
  if (row.sql.includes("users_old")) return false;
  return row.sql.includes("'guest'");
}

function migrateUsersForGuest(): void {
  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("PRAGMA legacy_alter_table=ON;");
  sqlite.transaction(() => {
    sqlite.exec("ALTER TABLE users RENAME TO users_old;");
    sqlite.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        username TEXT,
        display_name TEXT,
        bio TEXT,
        age INTEGER,
        date_of_birth INTEGER,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'guest')) DEFAULT 'guest',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    sqlite.exec(`
      INSERT INTO users (id, name, email, username, display_name, bio, age, date_of_birth, password_hash, role, created_at, updated_at)
      SELECT id, name, email, username, display_name, bio, age, date_of_birth, password_hash, role, created_at, updated_at FROM users_old;
    `);
    sqlite.exec("DROP TABLE users_old;");
  })();
  sqlite.exec("PRAGMA legacy_alter_table=OFF;");
  sqlite.exec("PRAGMA foreign_keys=ON;");
}

function migrateInvitesForGuest(): void {
  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("PRAGMA legacy_alter_table=ON;");
  sqlite.transaction(() => {
    sqlite.exec("ALTER TABLE invites RENAME TO invites_old;");
    sqlite.exec(`
      CREATE TABLE invites (
        id TEXT PRIMARY KEY,
        token TEXT NOT NULL UNIQUE,
        email TEXT,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'guest')) DEFAULT 'guest',
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        accepted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        accepted_at INTEGER,
        revoked_at INTEGER,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
    sqlite.exec(`
      INSERT INTO invites (id, token, email, role, created_by, accepted_by, accepted_at, revoked_at, expires_at, created_at, updated_at)
      SELECT id, token, email, role, created_by, accepted_by, accepted_at, revoked_at, expires_at, created_at, updated_at FROM invites_old;
    `);
    sqlite.exec("DROP TABLE invites_old;");
  })();
  sqlite.exec("PRAGMA legacy_alter_table=OFF;");
  sqlite.exec("PRAGMA foreign_keys=ON;");
}

function safeAddColumn(sql: string): void {
  try {
    sqlite.exec(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("duplicate column name")) {
      throw error;
    }
  }
}

function repairLegacyForeignKeys(legacyTable: string, targetTable: string): void {
  const rows = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE ?")
    .all(`%${legacyTable}%`) as Array<{ name: string; sql?: string }>;

  if (rows.length === 0) {
    return;
  }

  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("PRAGMA legacy_alter_table=ON;");
  sqlite.transaction(() => {
    for (const row of rows) {
      if (!row.sql || row.name === legacyTable) {
        continue;
      }

      const backupName = `${row.name}_legacy_backup_${crypto.randomUUID().replace(/-/g, "")}`;
      sqlite.exec(`ALTER TABLE "${row.name}" RENAME TO "${backupName}";`);

      const createSql = row.sql.replaceAll(legacyTable, targetTable);
      sqlite.exec(createSql);

      const columns = sqlite.prepare(`PRAGMA table_info("${backupName}")`).all() as Array<{ name: string }>;
      const columnList = columns.map((column) => `"${column.name}"`).join(", ");
      if (columnList) {
        sqlite.exec(`INSERT INTO "${row.name}" (${columnList}) SELECT ${columnList} FROM "${backupName}";`);
      }

      sqlite.exec(`DROP TABLE "${backupName}";`);
    }
  })();
  sqlite.exec("PRAGMA legacy_alter_table=OFF;");
  sqlite.exec("PRAGMA foreign_keys=ON;");
}

function ensureIndexes(): void {
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_roles_priority ON roles(priority);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
    CREATE INDEX IF NOT EXISTS idx_invite_roles_invite_id ON invite_roles(invite_id);
    CREATE INDEX IF NOT EXISTS idx_invite_roles_role_id ON invite_roles(role_id);
    CREATE INDEX IF NOT EXISTS idx_role_scope_overrides_role_id ON role_scope_overrides(role_id);
    CREATE INDEX IF NOT EXISTS idx_lists_board_id ON lists(board_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_name_unique ON boards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_list_id ON cards(list_id);
    CREATE INDEX IF NOT EXISTS idx_cards_done_entered_at ON cards(done_entered_at);
    CREATE INDEX IF NOT EXISTS idx_checklists_card_id ON checklists(card_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
    CREATE INDEX IF NOT EXISTS idx_labels_board_id ON labels(board_id);
    CREATE INDEX IF NOT EXISTS idx_card_labels_card_id ON card_labels(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_labels_label_id ON card_labels(label_id);
    CREATE INDEX IF NOT EXISTS idx_card_assignees_card_id ON card_assignees(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_assignees_user_id ON card_assignees(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_card_id ON attachments(card_id);
    CREATE INDEX IF NOT EXISTS idx_comments_board_id ON comments(board_id);
    CREATE INDEX IF NOT EXISTS idx_comments_list_id ON comments(list_id);
    CREATE INDEX IF NOT EXISTS idx_comments_card_id ON comments(card_id);
    CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON comment_mentions(user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_conversations_last_message_at ON thread_conversations(last_message_at);
    CREATE INDEX IF NOT EXISTS idx_thread_members_conversation_id ON thread_members(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_thread_members_user_id ON thread_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_messages_conversation_id ON thread_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_thread_messages_author_id ON thread_messages(author_id);
    CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at ON thread_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_thread_replies_parent_message_id ON thread_replies(parent_message_id);
    CREATE INDEX IF NOT EXISTS idx_thread_mentions_user_id ON thread_mentions(mentioned_user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_reply_mentions_user_id ON thread_reply_mentions(mentioned_user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_message_reactions_message_id ON thread_message_reactions(message_id);
    CREATE INDEX IF NOT EXISTS idx_thread_reply_reactions_reply_id ON thread_reply_reactions(reply_id);
    CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
    CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_board_name_active ON lists(board_id, name) WHERE archived_at IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
  `);
}


export function initializeDatabase(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT,
      display_name TEXT,
      bio TEXT,
      age INTEGER,
      date_of_birth INTEGER,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'guest')) DEFAULT 'guest',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      background TEXT NOT NULL DEFAULT 'teal-gradient',
      retention_mode TEXT NOT NULL DEFAULT 'card_and_attachments',
      retention_minutes INTEGER NOT NULL DEFAULT 10080,
      archive_retention_minutes INTEGER NOT NULL DEFAULT 10080,
      archived_at INTEGER,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

        CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      email TEXT,
      role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'guest')) DEFAULT 'guest',
      created_by TEXT NOT NULL,
      accepted_by TEXT,
      accepted_at INTEGER,
      revoked_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (accepted_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 1,
      mentionable INTEGER NOT NULL DEFAULT 0,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, role_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invite_roles (
      invite_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (invite_id, role_id),
      FOREIGN KEY (invite_id) REFERENCES invites(id) ON DELETE CASCADE,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS role_scope_overrides (
      role_id TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      access TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (role_id, scope_type, scope_id, permission),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      is_done_list INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      list_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
      cover_color TEXT,
      due_date INTEGER,
      position INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      archived_at INTEGER,
      done_entered_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklists (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id TEXT PRIMARY KEY,
      checklist_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS card_labels (
      card_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (card_id, label_id),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS card_assignees (
      card_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (card_id, user_id),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );


    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      list_id TEXT,
      card_id TEXT,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_reactions (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (comment_id, user_id, emoji),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_mentions (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      seen_at INTEGER,
      PRIMARY KEY (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('dm', 'channel')),
      name TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_message_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS thread_members (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at INTEGER NOT NULL,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY (conversation_id) REFERENCES thread_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT,
      body_encrypted TEXT,
      body_format TEXT NOT NULL DEFAULT 'plain',
      encryption_version INTEGER NOT NULL DEFAULT 1,
      is_forwarded INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES thread_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_replies (
      id TEXT PRIMARY KEY,
      parent_message_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT,
      body_encrypted TEXT,
      body_format TEXT NOT NULL DEFAULT 'plain',
      encryption_version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER,
      FOREIGN KEY (parent_message_id) REFERENCES thread_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES thread_messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_voice_notes (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      duration_sec INTEGER NOT NULL DEFAULT 0,
      storage_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (message_id) REFERENCES thread_messages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_mentions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      mentioned_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      seen_at INTEGER,
      FOREIGN KEY (message_id) REFERENCES thread_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_reply_mentions (
      id TEXT PRIMARY KEY,
      reply_id TEXT NOT NULL,
      mentioned_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      seen_at INTEGER,
      FOREIGN KEY (reply_id) REFERENCES thread_replies(id) ON DELETE CASCADE,
      FOREIGN KEY (mentioned_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS thread_message_reactions (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji),
      FOREIGN KEY (message_id) REFERENCES thread_messages(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS thread_reply_reactions (
      reply_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (reply_id, user_id, emoji),
      FOREIGN KEY (reply_id) REFERENCES thread_replies(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_roles_priority ON roles(priority);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
    CREATE INDEX IF NOT EXISTS idx_invite_roles_invite_id ON invite_roles(invite_id);
    CREATE INDEX IF NOT EXISTS idx_invite_roles_role_id ON invite_roles(role_id);
    CREATE INDEX IF NOT EXISTS idx_role_scope_overrides_role_id ON role_scope_overrides(role_id);
    CREATE INDEX IF NOT EXISTS idx_lists_board_id ON lists(board_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_name_unique ON boards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_list_id ON cards(list_id);
    CREATE INDEX IF NOT EXISTS idx_cards_done_entered_at ON cards(done_entered_at);

    CREATE INDEX IF NOT EXISTS idx_checklists_card_id ON checklists(card_id);
    CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
    CREATE INDEX IF NOT EXISTS idx_labels_board_id ON labels(board_id);
    CREATE INDEX IF NOT EXISTS idx_card_labels_card_id ON card_labels(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_labels_label_id ON card_labels(label_id);
    CREATE INDEX IF NOT EXISTS idx_card_assignees_card_id ON card_assignees(card_id);
    CREATE INDEX IF NOT EXISTS idx_card_assignees_user_id ON card_assignees(user_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_card_id ON attachments(card_id);
    CREATE INDEX IF NOT EXISTS idx_comments_board_id ON comments(board_id);
    CREATE INDEX IF NOT EXISTS idx_comments_list_id ON comments(list_id);
    CREATE INDEX IF NOT EXISTS idx_comments_card_id ON comments(card_id);
    CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON comment_mentions(user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_conversations_last_message_at ON thread_conversations(last_message_at);
    CREATE INDEX IF NOT EXISTS idx_thread_members_conversation_id ON thread_members(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_thread_members_user_id ON thread_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_messages_conversation_id ON thread_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_thread_messages_author_id ON thread_messages(author_id);
    CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at ON thread_messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_thread_replies_parent_message_id ON thread_replies(parent_message_id);
    CREATE INDEX IF NOT EXISTS idx_thread_mentions_user_id ON thread_mentions(mentioned_user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_reply_mentions_user_id ON thread_reply_mentions(mentioned_user_id);
    CREATE INDEX IF NOT EXISTS idx_thread_message_reactions_message_id ON thread_message_reactions(message_id);
    CREATE INDEX IF NOT EXISTS idx_thread_reply_reactions_reply_id ON thread_reply_reactions(reply_id);
    CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
    CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
  `);

  if (!tableAllowsGuest("users")) {
    migrateUsersForGuest();
  }
  if (!tableAllowsGuest("invites")) {
    migrateInvitesForGuest();
  }
  const boardColumns = sqlite.prepare("PRAGMA table_info(boards)").all() as Array<{ name: string }>;
  const boardColumnNames = new Set(boardColumns.map((column) => column.name));

  if (!boardColumnNames.has("retention_mode")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN retention_mode TEXT NOT NULL DEFAULT 'card_and_attachments'");
  }

  if (!boardColumnNames.has("retention_minutes")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN retention_minutes INTEGER NOT NULL DEFAULT 10080");
  }

  if (!boardColumnNames.has("archive_retention_minutes")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN archive_retention_minutes INTEGER NOT NULL DEFAULT 10080");
  }

  if (!boardColumnNames.has("archived_at")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN archived_at INTEGER");
  }

  const userColumns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const userColumnNames = new Set(userColumns.map((column) => column.name));

  if (!userColumnNames.has("username")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN username TEXT");
  }

  if (!userColumnNames.has("display_name")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN display_name TEXT");
  }

  if (!userColumnNames.has("bio")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN bio TEXT");
  }

  if (!userColumnNames.has("age")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN age INTEGER");
  }

  if (!userColumnNames.has("date_of_birth")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN date_of_birth INTEGER");
  }

  const commentMentionColumns = sqlite.prepare("PRAGMA table_info(comment_mentions)").all() as Array<{ name: string }>;
  const commentMentionColumnNames = new Set(commentMentionColumns.map((column) => column.name));

  if (!commentMentionColumnNames.has("seen_at")) {
    safeAddColumn("ALTER TABLE comment_mentions ADD COLUMN seen_at INTEGER");
  }

  const threadMentionColumns = sqlite.prepare("PRAGMA table_info(thread_mentions)").all() as Array<{ name: string }>;
  const threadMentionColumnNames = new Set(threadMentionColumns.map((column) => column.name));

  if (!threadMentionColumnNames.has("seen_at")) {
    safeAddColumn("ALTER TABLE thread_mentions ADD COLUMN seen_at INTEGER");
  }

  const threadReplyMentionColumns = sqlite.prepare("PRAGMA table_info(thread_reply_mentions)").all() as Array<{ name: string }>;
  const threadReplyMentionColumnNames = new Set(threadReplyMentionColumns.map((column) => column.name));

  if (!threadReplyMentionColumnNames.has("seen_at")) {
    safeAddColumn("ALTER TABLE thread_reply_mentions ADD COLUMN seen_at INTEGER");
  }

  const threadMessageColumns = sqlite.prepare("PRAGMA table_info(thread_messages)").all() as Array<{ name: string }>;
  const threadMessageColumnNames = new Set(threadMessageColumns.map((column) => column.name));

  if (!threadMessageColumnNames.has("is_forwarded")) {
    safeAddColumn("ALTER TABLE thread_messages ADD COLUMN is_forwarded INTEGER NOT NULL DEFAULT 0");
  }
  const listColumns = sqlite.prepare("PRAGMA table_info(lists)").all() as Array<{ name: string }>;
  const listColumnNames = new Set(listColumns.map((column) => column.name));

  if (!listColumnNames.has("archived_at")) {
    safeAddColumn("ALTER TABLE lists ADD COLUMN archived_at INTEGER");
  }

  sqlite.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_board_name_active ON lists(board_id, name) WHERE archived_at IS NULL");

  const cardColumns = sqlite.prepare("PRAGMA table_info(cards)").all() as Array<{ name: string }>;
  const cardColumnNames = new Set(cardColumns.map((column) => column.name));

  if (!cardColumnNames.has("cover_color")) {
    safeAddColumn("ALTER TABLE cards ADD COLUMN cover_color TEXT");
  }

  repairLegacyForeignKeys("users_old", "users");
  repairLegacyForeignKeys("invites_old", "invites");
  ensureIndexes();

  const roleSeeds = ensureDefaultRoles();
  ensureUserRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
  ensureInviteRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);



}

export function clearDatabaseForTests(): void {
  sqlite.exec(`
    DELETE FROM role_scope_overrides;
    DELETE FROM invite_roles;
    DELETE FROM user_roles;
    DELETE FROM role_permissions;
    DELETE FROM roles;
    DELETE FROM invites;
    DELETE FROM thread_reply_mentions;
    DELETE FROM thread_reply_reactions;
    DELETE FROM thread_message_reactions;
    DELETE FROM thread_mentions;
    DELETE FROM thread_voice_notes;
    DELETE FROM thread_attachments;
    DELETE FROM thread_replies;
    DELETE FROM thread_messages;
    DELETE FROM thread_members;
    DELETE FROM thread_conversations;
    DELETE FROM comment_mentions;
    DELETE FROM comment_reactions;
    DELETE FROM comments;
    DELETE FROM card_labels;
    DELETE FROM card_assignees;
    DELETE FROM labels;
    DELETE FROM checklist_items;
    DELETE FROM checklists;
    DELETE FROM attachments;
    DELETE FROM cards;
    DELETE FROM lists;
    DELETE FROM boards;
    DELETE FROM users;
  `);

  if (!tableAllowsGuest("users")) {
    migrateUsersForGuest();
  }
  if (!tableAllowsGuest("invites")) {
    migrateInvitesForGuest();
  }
  const boardColumns = sqlite.prepare("PRAGMA table_info(boards)").all() as Array<{ name: string }>;
  const boardColumnNames = new Set(boardColumns.map((column) => column.name));

  if (!boardColumnNames.has("retention_mode")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN retention_mode TEXT NOT NULL DEFAULT 'card_and_attachments'");
  }

  if (!boardColumnNames.has("retention_minutes")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN retention_minutes INTEGER NOT NULL DEFAULT 10080");
  }

  if (!boardColumnNames.has("archive_retention_minutes")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN archive_retention_minutes INTEGER NOT NULL DEFAULT 10080");
  }

  if (!boardColumnNames.has("archived_at")) {
    safeAddColumn("ALTER TABLE boards ADD COLUMN archived_at INTEGER");
  }

  const userColumns = sqlite.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const userColumnNames = new Set(userColumns.map((column) => column.name));

  if (!userColumnNames.has("username")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN username TEXT");
  }

  if (!userColumnNames.has("display_name")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN display_name TEXT");
  }

  if (!userColumnNames.has("bio")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN bio TEXT");
  }

  if (!userColumnNames.has("age")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN age INTEGER");
  }

  if (!userColumnNames.has("date_of_birth")) {
    safeAddColumn("ALTER TABLE users ADD COLUMN date_of_birth INTEGER");
  }

  const cardColumns = sqlite.prepare("PRAGMA table_info(cards)").all() as Array<{ name: string }>;
  const cardColumnNames = new Set(cardColumns.map((column) => column.name));

  if (!cardColumnNames.has("cover_color")) {
    safeAddColumn("ALTER TABLE cards ADD COLUMN cover_color TEXT");
  }

  repairLegacyForeignKeys("users_old", "users");
  repairLegacyForeignKeys("invites_old", "invites");
  ensureIndexes();

  const roleSeeds = ensureDefaultRoles();
  ensureUserRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
  ensureInviteRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);



}









































