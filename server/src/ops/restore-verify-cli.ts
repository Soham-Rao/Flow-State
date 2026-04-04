import mysql, { type RowDataPacket } from "mysql2/promise";

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

const mysqlUrl = getArg("--mysql-url") ?? process.env.BACKUP_VERIFY_SCRATCH_MYSQL_URL ?? null;

if (!mysqlUrl) {
  console.error("Usage: restore-verify-cli --mysql-url <scratch-mysql-url>");
  process.exit(1);
}

const requiredTables = ["__drizzle_migrations", "users", "roles", "boards", "thread_messages", "activity_logs"];

const connection = await mysql.createConnection({ uri: mysqlUrl });

try {
  await connection.query("SELECT 1");
  const [rows] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
    "SELECT table_name AS tableName FROM information_schema.tables WHERE table_schema = DATABASE()"
  );
  const tableSet = new Set(rows.map((row) => row.tableName));
  const missingTables = requiredTables.filter((table) => !tableSet.has(table));
  if (missingTables.length > 0) {
    throw new Error(`Missing required tables after restore verification: ${missingTables.join(", ")}`);
  }

  const [migrationRows] = await connection.query<Array<RowDataPacket & { count: number }>>(
    "SELECT COUNT(*) AS count FROM __drizzle_migrations"
  );

  process.stdout.write(JSON.stringify({
    ok: true,
    database: new URL(mysqlUrl).pathname.replace(/^\//, ""),
    migrationCount: Number(migrationRows[0]?.count ?? 0),
    checkedTables: requiredTables
  }));
} finally {
  await connection.end();
}
