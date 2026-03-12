import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

function resolveDatabasePath(rawPath: string): string {
  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(process.cwd(), rawPath);
}

const resolvedDatabasePath = resolveDatabasePath(env.DATABASE_URL);
fs.mkdirSync(path.dirname(resolvedDatabasePath), { recursive: true });

export const sqlite = new Database(resolvedDatabasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
