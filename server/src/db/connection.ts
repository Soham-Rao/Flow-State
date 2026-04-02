import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

export const pool = mysql.createPool({
  uri: env.MYSQL_URL,
  connectionLimit: 10
});

export const db = drizzle(pool, { schema, mode: "default" });

export type DbTransaction = Parameters<typeof db.transaction>[0] extends (tx: infer T, ...args: any) => any ? T : never;

export async function closePool(): Promise<void> {
  await pool.end();
}
  