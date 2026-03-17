import crypto from "node:crypto";

import { sqlite } from "./connection.js";

export function tableAllowsGuest(tableName: string): boolean {
  const row = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(tableName) as { sql?: string };
  if (!row?.sql) return true;
  if (row.sql.includes("users_old")) return false;
  return row.sql.includes("'guest'");
}

export function migrateUsersForGuest(): void {
  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("PRAGMA legacy_alter_table=ON;");
  sqlite.transaction(() => {
    sqlite.exec("ALTER TABLE users RENAME TO users_old;");
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
    `);
    sqlite.exec(`INSERT INTO users SELECT id, name, email, username, display_name, bio, age, date_of_birth, password_hash, role, created_at, updated_at FROM users_old;`);
    sqlite.exec("DROP TABLE users_old;");
  })();
  sqlite.exec("PRAGMA legacy_alter_table=OFF;");
  sqlite.exec("PRAGMA foreign_keys=ON;");
}

export function migrateInvitesForGuest(): void {
  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("PRAGMA legacy_alter_table=ON;");
  sqlite.transaction(() => {
    sqlite.exec("ALTER TABLE invites RENAME TO invites_old;");
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS invites (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'guest')) DEFAULT 'guest',
        invite_token TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    sqlite.exec(`INSERT INTO invites SELECT id, email, role, invite_token, expires_at, created_at FROM invites_old;`);
    sqlite.exec("DROP TABLE invites_old;");
  })();
  sqlite.exec("PRAGMA legacy_alter_table=OFF;");
  sqlite.exec("PRAGMA foreign_keys=ON;");
}

function safeAddColumn(sql: string): void {
  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec(sql);
  sqlite.exec("PRAGMA foreign_keys=ON;");
}

export function repairLegacyForeignKeys(legacyTable: string, targetTable: string): void {
  const rows = sqlite.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all() as Array<{ name: string; sql?: string }>;
  const targets = rows.filter((row) => row.sql && row.sql.includes(legacyTable));
  if (targets.length === 0) return;

  sqlite.exec("PRAGMA foreign_keys=OFF;");
  sqlite.exec("PRAGMA legacy_alter_table=ON;");
  sqlite.transaction(() => {
    for (const row of targets) {
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

export function applySchemaMigrations(): void {
  sqlite.transaction(() => {
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

    const threadMemberColumns = sqlite.prepare("PRAGMA table_info(thread_members)").all() as Array<{ name: string }>;
    const threadMemberColumnNames = new Set(threadMemberColumns.map((column) => column.name));

    if (!threadMemberColumnNames.has("last_read_at")) {
      safeAddColumn("ALTER TABLE thread_members ADD COLUMN last_read_at INTEGER");
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

    const cardColumns = sqlite.prepare("PRAGMA table_info(cards)").all() as Array<{ name: string }>;
    const cardColumnNames = new Set(cardColumns.map((column) => column.name));

    if (!cardColumnNames.has("cover_color")) {
      safeAddColumn("ALTER TABLE cards ADD COLUMN cover_color TEXT");
    }
  })();
}

export function ensureIndexes(): void {
  sqlite.transaction(() => {
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
      CREATE INDEX IF NOT EXISTS idx_thread_members_last_read_at ON thread_members(last_read_at);
      CREATE INDEX IF NOT EXISTS idx_thread_messages_conversation_id ON thread_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_thread_messages_author_id ON thread_messages(author_id);
      CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at ON thread_messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_thread_message_deletions_message_id ON thread_message_deletions(message_id);
      CREATE INDEX IF NOT EXISTS idx_thread_message_deletions_user_id ON thread_message_deletions(user_id);
      CREATE INDEX IF NOT EXISTS idx_thread_replies_parent_message_id ON thread_replies(parent_message_id);
      CREATE INDEX IF NOT EXISTS idx_thread_mentions_user_id ON thread_mentions(mentioned_user_id);
      CREATE INDEX IF NOT EXISTS idx_thread_reply_mentions_user_id ON thread_reply_mentions(mentioned_user_id);
      CREATE INDEX IF NOT EXISTS idx_thread_message_reactions_message_id ON thread_message_reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_thread_reply_reactions_reply_id ON thread_reply_reactions(reply_id);
      CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
      CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_board_name_active ON lists(board_id, name) WHERE archived_at IS NULL;
    `);
  })();
}
