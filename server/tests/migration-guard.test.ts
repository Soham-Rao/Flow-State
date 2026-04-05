import { describe, expect, it } from "vitest";

import { analyzeMigrationRisk, detectRiskyMigration } from "../src/db/migration-guard.js";

describe("migration guard", () => {
  it("treats additive migrations as safe by default", () => {
    const sql = `
      ALTER TABLE boards ADD COLUMN archived_at datetime(3) NULL;
      CREATE INDEX idx_boards_archived_at ON boards (archived_at);
    `;

    expect(detectRiskyMigration(sql)).toBe(false);
    expect(analyzeMigrationRisk(sql)).toEqual({
      risky: false,
      riskReasons: [],
      acknowledged: false,
      acknowledgement: null
    });
  });

  it("classifies destructive migration patterns", () => {
    expect(analyzeMigrationRisk("ALTER TABLE cards DROP COLUMN legacy_field;").riskReasons).toContain("drop_column");
    expect(analyzeMigrationRisk("TRUNCATE TABLE audit_logs;").riskReasons).toContain("truncate_table");
    expect(analyzeMigrationRisk("DELETE FROM comments WHERE created_at < NOW();").riskReasons).toContain("delete_from");
    expect(analyzeMigrationRisk("RENAME TABLE boards TO boards_archive;").riskReasons).toContain("rename_table");
    expect(analyzeMigrationRisk("ALTER TABLE cards CHANGE title old_title varchar(255);").riskReasons).toContain("change_column");
  });

  it("flags broad table-wide updates as risky", () => {
    const sql = "UPDATE users SET role = 'guest';";

    const analysis = analyzeMigrationRisk(sql);

    expect(analysis.risky).toBe(true);
    expect(analysis.riskReasons).toContain("broad_update");
  });

  it("recognizes explicit risk acknowledgements", () => {
    const sql = `
      -- @flowstate-risk-ack: cleanup after compatibility window
      DELETE FROM comments WHERE created_at < NOW();
    `;

    const analysis = analyzeMigrationRisk(sql);

    expect(analysis.risky).toBe(true);
    expect(analysis.acknowledged).toBe(true);
    expect(analysis.acknowledgement).toBe("cleanup after compatibility window");
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
