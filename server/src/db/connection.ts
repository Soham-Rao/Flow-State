import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

export const pool = mysql.createPool({
  uri: env.MYSQL_URL,
  connectionLimit: 10
});

function normalizeSqlForLogs(statement: unknown): string | null {
  const raw = typeof statement === "string"
    ? statement
    : statement && typeof statement === "object" && "sql" in statement
      ? String((statement as { sql?: unknown }).sql ?? "")
      : null;

  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/'[^']*'/g, "?")
    .replace(/"[^"]*"/g, "?")
    .replace(/\b\d+\b/g, "?")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 180)}...`;
}

function instrumentPoolMethod(methodName: "query" | "execute"): void {
  const original = pool[methodName].bind(pool) as (...args: unknown[]) => Promise<unknown>;

  const wrapped = (async (...args: unknown[]) => {
    const startedAt = Date.now();
    try {
      return await original(...args);
    } finally {
      const durationMs = Date.now() - startedAt;
      if (env.DB_SLOW_QUERY_THRESHOLD_MS > 0 && durationMs >= env.DB_SLOW_QUERY_THRESHOLD_MS) {
        logger.warn("db.slow_query", {
          method: methodName,
          durationMs,
          statement: normalizeSqlForLogs(args[0]),
          hasParameters: args.length > 1
        });
      }
    }
  }) as typeof pool.query;

  (pool[methodName] as unknown) = wrapped;
}

instrumentPoolMethod("query");
instrumentPoolMethod("execute");

export const db = drizzle(pool, { schema, mode: "default" });

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withDbTransaction<T>(task: (tx: DbTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => task(tx));
}

export async function closePool(): Promise<void> {
  await pool.end();
}
