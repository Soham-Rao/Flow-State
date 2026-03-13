import { sqlite } from "./connection.js";

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
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
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
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
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
      PRIMARY KEY (comment_id, user_id),
      FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

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
    CREATE INDEX IF NOT EXISTS idx_invites_email ON invites(email);
    CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username) WHERE username IS NOT NULL;
  `);

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

}

export function clearDatabaseForTests(): void {
  sqlite.exec(`
    DELETE FROM invites;
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

}