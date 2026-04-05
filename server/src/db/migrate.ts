import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/mysql2/migrator";

import { logger } from "../utils/logger.js";
import { db, pool } from "./connection.js";
import { prepareMigrationRun, runMigrationPostchecks } from "./migration-guard.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle"
);

export async function runMigrations(): Promise<void> {
  const migrationRun = await prepareMigrationRun(migrationsFolder);
  try {
    await migrate(db, { migrationsFolder });
    await runMigrationPostchecks();
    logger.info("db.migrations_complete", {
      pendingCount: migrationRun.pendingMigrations.length,
      riskyCount: migrationRun.riskyMigrations.length,
      pendingFiles: migrationRun.pendingMigrations.map((migration) => migration.fileName),
      riskyFiles: migrationRun.riskyMigrations.map((migration) => migration.fileName),
      acknowledgedRiskyFiles: migrationRun.riskyMigrations.filter((migration) => migration.acknowledged).map((migration) => migration.fileName)
    });
  } finally {
    await migrationRun.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error("Failed to run migrations", error);
      await pool.end();
      process.exit(1);
    });
}

