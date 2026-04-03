import type { RowDataPacket } from "mysql2/promise";

import { pool } from "./connection.js";
import { ensureDefaultRoles, ensureInviteRoleAssignments, ensureUserRoleAssignments } from "./init-roles.js";
import { runMigrations } from "./migrate.js";

let migrationLock: Promise<void> = Promise.resolve();

async function withMigrationLock(task: () => Promise<void>): Promise<void> {
  const run = migrationLock.then(task, task);
  migrationLock = run.catch(() => {});
  return run;
}

async function seedRoles(): Promise<void> {
  const roleSeeds = await ensureDefaultRoles();
  await ensureUserRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
  await ensureInviteRoleAssignments(roleSeeds.adminRoleId, roleSeeds.memberRoleId, roleSeeds.guestRoleId);
}

async function dropAllTables(): Promise<void> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
      "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    const tableNames = Array.isArray(rows) ? rows.map((row) => row.tableName) : [];
    if (tableNames.length === 0) {
      return;
    }

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const tableName of tableNames) {
      await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    connection.release();
  }
}

export async function initializeDatabase(): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    await clearDatabaseForTests();
    return;
  }

  await withMigrationLock(async () => {
    await runMigrations();
    await seedRoles();
  });
}

export async function clearDatabaseForTests(): Promise<void> {
  await withMigrationLock(async () => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
        "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()"
      );
      const tableNames = Array.isArray(rows) ? rows.map((row) => row.tableName) : [];
      if (tableNames.length === 0) {
        await runMigrations();
        await seedRoles();
        return;
      }

      const migrationTable = "__drizzle_migrations";
      const hasMigrationTable = tableNames.includes(migrationTable);
      if (!hasMigrationTable) {
        await dropAllTables();
        await runMigrations();
        await seedRoles();
        return;
      }

      const [migrationRows] = await connection.query<Array<RowDataPacket & { count: number }>>(
        `SELECT COUNT(*) as count FROM ${migrationTable}`
      );
      const migrationCount = Number(migrationRows[0]?.count ?? 0);
      const hasOtherTables = tableNames.some((name) => name !== migrationTable);
      if (hasOtherTables && migrationCount === 0) {
        await dropAllTables();
        await runMigrations();
        await seedRoles();
        return;
      }

      await connection.query("SET FOREIGN_KEY_CHECKS = 0");
      for (const tableName of tableNames) {
        if (tableName === migrationTable) {
          continue;
        }
        await connection.query(`TRUNCATE TABLE \`${tableName}\``);
      }
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
      await runMigrations();
      await seedRoles();
    } finally {
      connection.release();
    }
  });
}

