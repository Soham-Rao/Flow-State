import fs from "node:fs";
import path from "node:path";

import type { RowDataPacket } from "mysql2/promise";

import { env } from "../config/env.js";
import { pool } from "./connection.js";
import { logger } from "../utils/logger.js";

const MIGRATION_LOCK_NAME = "flowstate:migrations";
const WORKSPACE_TENANCY_MIGRATION = "0011_add_workspace_tenancy.sql";
const REQUIRED_TABLES = ["users", "workspaces", "workspace_memberships", "roles", "boards", "__drizzle_migrations"];
const RISK_ACK_PATTERN = /^\s*--\s*@flowstate-risk-ack:\s*(.+)$/im;
const RISK_RULES = [
  { code: "drop_table", pattern: /\bdrop\s+table\b/i },
  { code: "drop_column", pattern: /\bdrop\s+column\b/i },
  { code: "drop_index", pattern: /\bdrop\s+index\b/i },
  { code: "truncate_table", pattern: /\btruncate\s+table\b/i },
  { code: "rename_table", pattern: /\brename\s+table\b/i },
  { code: "rename_column", pattern: /\balter\s+table\b[\s\S]*\brename\s+column\b/i },
  { code: "change_column", pattern: /\balter\s+table\b[\s\S]*\bchange\b/i },
  { code: "delete_from", pattern: /\bdelete\s+from\b/i }
] as const;

type MigrationRiskCode = (typeof RISK_RULES)[number]["code"] | "broad_update";

export interface MigrationRiskAnalysis {
  risky: boolean;
  riskReasons: MigrationRiskCode[];
  acknowledged: boolean;
  acknowledgement: string | null;
}

export interface PendingMigrationInfo extends MigrationRiskAnalysis {
  fileName: string;
  filePath: string;
}

export interface MigrationRunPreparation {
  pendingMigrations: PendingMigrationInfo[];
  riskyMigrations: PendingMigrationInfo[];
  release: () => Promise<void>;
}

export interface MigrationInventory {
  pendingMigrations: PendingMigrationInfo[];
  riskyMigrations: PendingMigrationInfo[];
  acknowledgedRiskyMigrations: PendingMigrationInfo[];
}

let preWorkspaceMigrationRowCounts: Map<string, number> | null = null;

async function snapshotExistingTableRowCounts(): Promise<Map<string, number>> {
  const [tables] = await pool.query<Array<RowDataPacket & { tableName: string }>>(
    "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> '__drizzle_migrations'"
  );
  const counts = new Map<string, number>();
  for (const { tableName } of tables) {
    const [rows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      `SELECT COUNT(*) AS count FROM \`${tableName.replace(/`/g, "``")}\``
    );
    counts.set(tableName, Number(rows[0]?.count ?? 0));
  }
  return counts;
}

function stripComments(sqlText: string): string {
  return sqlText.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractRiskAcknowledgement(sqlText: string): string | null {
  const match = sqlText.match(RISK_ACK_PATTERN);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function hasBroadTableWideUpdate(sqlText: string): boolean {
  const normalized = stripComments(sqlText);
  const statements = normalized.split(";").map((statement) => statement.trim()).filter(Boolean);

  return statements.some((statement) => /\bupdate\s+[`"\w.]+\s+set\b/i.test(statement) && !/\bwhere\b/i.test(statement));
}

export function analyzeMigrationRisk(sqlText: string): MigrationRiskAnalysis {
  const normalized = stripComments(sqlText);
  const riskReasons: MigrationRiskCode[] = RISK_RULES
    .filter((rule) => rule.pattern.test(normalized))
    .map((rule) => rule.code as MigrationRiskCode);

  if (hasBroadTableWideUpdate(sqlText)) {
    riskReasons.push("broad_update");
  }

  const acknowledgement = extractRiskAcknowledgement(sqlText);

  return {
    risky: riskReasons.length > 0,
    riskReasons,
    acknowledged: riskReasons.length === 0 ? false : acknowledgement !== null,
    acknowledgement
  };
}

export function detectRiskyMigration(sqlText: string): boolean {
  return analyzeMigrationRisk(sqlText).risky;
}

async function getAppliedMigrationCount(): Promise<number> {
  try {
    const [rows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      "SELECT COUNT(*) AS count FROM __drizzle_migrations"
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

function listSqlMigrationFiles(migrationsFolder: string): string[] {
  return fs.readdirSync(migrationsFolder)
    .filter((entry) => entry.endsWith(".sql"))
    .sort();
}

async function acquireMigrationLock(): Promise<void> {
  const [rows] = await pool.query<Array<RowDataPacket & { acquired: number | null }>>(
    "SELECT GET_LOCK(?, 10) AS acquired",
    [MIGRATION_LOCK_NAME]
  );
  const acquired = Number(rows[0]?.acquired ?? 0);
  if (acquired !== 1) {
    throw new Error("Could not acquire migration advisory lock");
  }
}

async function releaseMigrationLock(): Promise<void> {
  try {
    await pool.query("DO RELEASE_LOCK(?)", [MIGRATION_LOCK_NAME]);
  } catch (error) {
    logger.warn("db.migration_lock_release_failed", { error });
  }
}

export async function getPendingMigrationInventory(migrationsFolder: string): Promise<MigrationInventory> {
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }

  const appliedCount = await getAppliedMigrationCount();
  const migrationFiles = listSqlMigrationFiles(migrationsFolder);
  const pendingFiles = migrationFiles.slice(appliedCount);
  const pendingMigrations = pendingFiles.map((fileName) => {
    const filePath = path.join(migrationsFolder, fileName);
    const sqlText = fs.readFileSync(filePath, "utf8");
    const analysis = analyzeMigrationRisk(sqlText);

    return {
      fileName,
      filePath,
      risky: analysis.risky,
      riskReasons: analysis.riskReasons,
      acknowledged: analysis.acknowledged,
      acknowledgement: analysis.acknowledgement
    } satisfies PendingMigrationInfo;
  });

  return {
    pendingMigrations,
    riskyMigrations: pendingMigrations.filter((migration) => migration.risky),
    acknowledgedRiskyMigrations: pendingMigrations.filter((migration) => migration.risky && migration.acknowledged)
  };
}

export async function prepareMigrationRun(migrationsFolder: string): Promise<MigrationRunPreparation> {
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }

  await acquireMigrationLock();

  try {
    await pool.query("SELECT 1");
    const inventory = await getPendingMigrationInventory(migrationsFolder);
    preWorkspaceMigrationRowCounts = inventory.pendingMigrations.some(
      (migration) => migration.fileName === WORKSPACE_TENANCY_MIGRATION
    )
      ? await snapshotExistingTableRowCounts()
      : null;
    const unacknowledgedRisky = inventory.riskyMigrations.filter((migration) => !migration.acknowledged);

    if (unacknowledgedRisky.length > 0) {
      throw new Error(
        `Risky pending migrations require an explicit -- @flowstate-risk-ack: <reason> comment. Pending risky files without acknowledgement: ${unacknowledgedRisky.map((migration) => migration.fileName).join(", ")}`
      );
    }

    if (
      env.NODE_ENV === "production" &&
      inventory.riskyMigrations.length > 0 &&
      (!process.env.FLOWSTATE_LAST_BACKUP_MANIFEST || !fs.existsSync(process.env.FLOWSTATE_LAST_BACKUP_MANIFEST))
    ) {
      throw new Error(
        `Risky pending migrations require a valid FLOWSTATE_LAST_BACKUP_MANIFEST. Pending risky files: ${inventory.riskyMigrations.map((migration) => migration.fileName).join(", ")}`
      );
    }

    logger.info("db.migrations_prepare", {
      pendingCount: inventory.pendingMigrations.length,
      riskyCount: inventory.riskyMigrations.length,
      pendingFiles: inventory.pendingMigrations.map((migration) => migration.fileName),
      riskyFiles: inventory.riskyMigrations.map((migration) => migration.fileName),
      acknowledgedRiskyFiles: inventory.acknowledgedRiskyMigrations.map((migration) => migration.fileName)
    });

    return {
      pendingMigrations: inventory.pendingMigrations,
      riskyMigrations: inventory.riskyMigrations,
      release: releaseMigrationLock
    };
  } catch (error) {
    await releaseMigrationLock();
    throw error;
  }
}

export async function runMigrationPostchecks(): Promise<void> {
  const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
  const [rows] = await pool.query<Array<RowDataPacket & { tableName: string }>>(
    `SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${placeholders})`,
    REQUIRED_TABLES
  );

  const tableSet = new Set(rows.map((row) => row.tableName));
  const missing = REQUIRED_TABLES.filter((tableName) => !tableSet.has(tableName));
  if (missing.length > 0) {
    throw new Error(`Migration postcheck failed. Missing required tables: ${missing.join(", ")}`);
  }

  if (preWorkspaceMigrationRowCounts) {
    for (const [tableName, beforeCount] of preWorkspaceMigrationRowCounts) {
      const [countRows] = await pool.query<Array<RowDataPacket & { count: number }>>(
        `SELECT COUNT(*) AS count FROM \`${tableName.replace(/`/g, "``")}\``
      );
      const afterCount = Number(countRows[0]?.count ?? 0);
      if (afterCount < beforeCount) {
        throw new Error(
          `Workspace migration row-preservation check failed for ${tableName}: before=${beforeCount}, after=${afterCount}`
        );
      }
    }
    preWorkspaceMigrationRowCounts = null;
  }

  const tenantTables = [
    "invites",
    "email_notification_deliveries",
    "calendar_feed_tokens",
    "bug_reports",
    "roles",
    "user_roles",
    "boards",
    "announcements",
    "thread_conversations",
    "activity_logs"
  ];
  for (const tableName of tenantTables) {
    const [nullRows] = await pool.query<Array<RowDataPacket & { count: number }>>(
      `SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE workspace_id IS NULL`
    );
    if (Number(nullRows[0]?.count ?? 0) !== 0) {
      throw new Error(`Migration postcheck failed. ${tableName} contains rows without a workspace`);
    }
  }

  const integrityChecks: Array<{ label: string; sql: string }> = [
    {
      label: "role assignments crossing workspaces",
      sql: "SELECT COUNT(*) AS count FROM user_roles ur INNER JOIN roles r ON r.id = ur.role_id WHERE ur.workspace_id <> r.workspace_id"
    },
    {
      label: "role assignments without a membership",
      sql: "SELECT COUNT(*) AS count FROM user_roles ur LEFT JOIN workspace_memberships wm ON wm.workspace_id = ur.workspace_id AND wm.user_id = ur.user_id WHERE wm.user_id IS NULL"
    },
    {
      label: "board members outside the board workspace",
      sql: "SELECT COUNT(*) AS count FROM board_members bm INNER JOIN boards b ON b.id = bm.board_id LEFT JOIN workspace_memberships wm ON wm.workspace_id = b.workspace_id AND wm.user_id = bm.user_id WHERE wm.user_id IS NULL"
    },
    {
      label: "thread members outside the conversation workspace",
      sql: "SELECT COUNT(*) AS count FROM thread_members tm INNER JOIN thread_conversations tc ON tc.id = tm.conversation_id LEFT JOIN workspace_memberships wm ON wm.workspace_id = tc.workspace_id AND wm.user_id = tm.user_id WHERE wm.user_id IS NULL"
    }
  ];

  for (const check of integrityChecks) {
    const [checkRows] = await pool.query<Array<RowDataPacket & { count: number }>>(check.sql);
    if (Number(checkRows[0]?.count ?? 0) !== 0) {
      throw new Error(`Migration postcheck failed. Found ${check.label}`);
    }
  }
}


