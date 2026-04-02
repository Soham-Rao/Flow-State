# Phase 12.0 — MySQL DDL‑Only Switch (Pre‑Prod)

## Summary
Switch the server from SQLite to **MySQL 8.0** before production using **DDL‑only migrations** (schema/constraints/indexes). No data migration. Dev/test uses a Docker MySQL instance to validate schema and app behavior. Replace SQLite‑specific connection, schema, and init logic with MySQL equivalents, and adopt Drizzle migrations for schema creation.

## Key Changes
1. **DB Connection + Env**
   - Add MySQL connection config in `server/src/config/env.ts`: prefer `MYSQL_URL` (e.g., `mysql://user:pass@host:3306/db`).
   - Replace `better-sqlite3` usage with `mysql2/promise` + `drizzle-orm/mysql2` pool in `server/src/db/connection.ts`.
   - Remove SQLite PRAGMAs and filesystem path logic.

2. **Schema Conversion (SQLite → MySQL)**
   - Convert `server/src/db/schema.ts` from `sqliteTable` to `mysqlTable`.
   - Convert types:
     - IDs: `char(36)` or `varchar(36)` (use `char(36)` for UUIDs).
     - Timestamps: `datetime("...",{ mode:"date", fsp: 3 })` to preserve ms.
     - Booleans: `boolean()` (maps to tinyint).
     - Text/JSON: keep as `text` for parity (no JSON change in 12.0).
   - Re‑express indexes using MySQL schema helpers or migrations.

3. **Migrations & Init Flow**
   - Introduce Drizzle migrations for MySQL (DDL‑only):
     - Add `drizzle.config.ts` (MySQL driver, schema path).
     - Add a `server/src/db/migrate.ts` runner using `drizzle-orm/mysql2/migrator`.
   - Update `server/src/db/init.ts` and `server/src/index.ts`:
     - Replace SQLite `initializeDatabase()` behavior with a **migration‑only** step.
     - Remove/disable SQLite‑specific files (`init-schema.ts`, `init-migrations.ts`) or keep but unused.
   - Ensure default role/user seeding still runs **after** migrations.

4. **Dependencies & Scripts**
   - Server deps:
     - Add `mysql2`.
     - Remove `better-sqlite3` + `@types/better-sqlite3`.
     - Add `drizzle-kit` as a dev dependency.
   - Add scripts:
     - `db:migrate` (runs MySQL migrations).
     - `db:generate` (drizzle‑kit generate).
     - Optional `db:drop` or `db:reset` for test DBs only.

5. **Test/Dev Setup (Docker MySQL)**
   - Provide a `docker-compose.yml` (or `.env.example`) for MySQL 8.0 with:
     - `flowstate_dev` and `flowstate_test` databases.
   - Update tests to point at `MYSQL_URL` with the test DB.
   - Replace any test‑only `clearDatabaseForTests()` calls with:
     - Truncate all tables in dependency order, or
     - Drop and recreate schema via migrations.

## Test Plan
- **Unit/API tests**: `bun run --cwd server test` against MySQL Docker.
- **Manual sanity**:
  - Register/login
  - Create board/list/card
  - Create channel + DM message
  - Add comment + mention
  - Announcements flow
- **Migration verification**:
  - Fresh empty MySQL DB → `db:migrate` → app boots clean.

## Assumptions
- Canonical domain is **`flo-state.in`**, and `www` redirects to apex.
- MySQL 8.0 is available in hosting and Docker locally.
- DDL‑only migration is acceptable and no data transfer is needed.
- SQLite test DB artifacts can be discarded since we’re pre‑prod.

