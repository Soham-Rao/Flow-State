import fs from "node:fs";
import path from "node:path";

import type { RowDataPacket } from "mysql2/promise";

import { env } from "../config/env.js";
import { pool } from "./connection.js";
import { logger } from "../utils/logger.js";

const MIGRATION_LOCK_NAME = "flowstate:migrations";
const REQUIRED_TABLES = ["users", "roles", "boards", "__drizzle_migrations"];
const RISKY_MIGRATION_PATTERN = /\b(drop\s+(table|column|index)|truncate\s+table|delete\s+from|alter\s+table[\s\S]*\bdrop\b)\b/i;

export interface PendingMigrationInfo {
  fileName: string;
  filePath: string;
  risky: boolean;
}

export interface MigrationRunPreparation {
  pendingMigrations: PendingMigrationInfo[];
  riskyMigrations: PendingMigrationInfo[];
  release: () => Promise<void>;
}

export function detectRiskyMigration(sqlText: string): boolean {
  const normalized = sqlText.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return RISKY_MIGRATION_PATTERN.test(normalized);
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

export async function prepareMigrationRun(migrationsFolder: string): Promise<MigrationRunPreparation> {
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`Migrations folder not found: ${migrationsFolder}`);
  }

  await acquireMigrationLock();

  try {
    await pool.query("SELECT 1");
    const appliedCount = await getAppliedMigrationCount();
    const migrationFiles = listSqlMigrationFiles(migrationsFolder);
    const pendingFiles = migrationFiles.slice(appliedCount);
    const pendingMigrations = pendingFiles.map((fileName) => {
      const filePath = path.join(migrationsFolder, fileName);
      const sqlText = fs.readFileSync(filePath, "utf8");
      return {
        fileName,
        filePath,
        risky: detectRiskyMigration(sqlText)
      };
    });
    const riskyMigrations = pendingMigrations.filter((migration) => migration.risky);

    if (
      env.NODE_ENV === "production" &&
      riskyMigrations.length > 0 &&
      (!process.env.FLOWSTATE_LAST_BACKUP_MANIFEST || !fs.existsSync(process.env.FLOWSTATE_LAST_BACKUP_MANIFEST))
    ) {
      throw new Error(
        `Risky pending migrations require a valid FLOWSTATE_LAST_BACKUP_MANIFEST. Pending risky files: ${riskyMigrations.map((migration) => migration.fileName).join(", ")}`
      );
    }

    logger.info("db.migrations_prepare", {
      pendingCount: pendingMigrations.length,
      riskyCount: riskyMigrations.length,
      pendingFiles: pendingMigrations.map((migration) => migration.fileName)
    });

    return {
      pendingMigrations,
      riskyMigrations,
      release: releaseMigrationLock
    };
  } catch (error) {
    await releaseMigrationLock();
    throw error;
  }
}

export async function runMigrationPostchecks(): Promise<void> {
  const [rows] = await pool.query<Array<RowDataPacket & { tableName: string }>>(
    "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (?, ?, ?, ?)",
    REQUIRED_TABLES
  );

  const tableSet = new Set(rows.map((row) => row.tableName));
  const missing = REQUIRED_TABLES.filter((tableName) => !tableSet.has(tableName));
  if (missing.length > 0) {
    throw new Error(`Migration postcheck failed. Missing required tables: ${missing.join(", ")}`);
  }
}
