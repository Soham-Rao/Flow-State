import { describe, expect, it } from "vitest";

import { detectRiskyMigration } from "../src/db/migration-guard.js";

describe("migration guard", () => {
  it("treats additive migrations as safe by default", () => {
    const sql = `
      ALTER TABLE boards ADD COLUMN archived_at datetime(3) NULL;
      CREATE INDEX idx_boards_archived_at ON boards (archived_at);
    `;

    expect(detectRiskyMigration(sql)).toBe(false);
  });

  it("flags destructive migrations as risky", () => {
    expect(detectRiskyMigration("ALTER TABLE cards DROP COLUMN legacy_field;")).toBe(true);
    expect(detectRiskyMigration("TRUNCATE TABLE audit_logs;")).toBe(true);
    expect(detectRiskyMigration("DELETE FROM comments WHERE created_at < NOW();")).toBe(true);
  });

  it("ignores destructive keywords inside comments", () => {
    const sql = `
      -- DROP TABLE users;
      /* DELETE FROM cards; */
      CREATE TABLE backup_checks (
        id char(36) primary key
      );
    `;

    expect(detectRiskyMigration(sql)).toBe(false);
  });
});
