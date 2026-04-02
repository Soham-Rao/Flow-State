import path from "node:path";
import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/mysql2/migrator";

import { db, pool } from "./connection.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../drizzle"
);

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
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
