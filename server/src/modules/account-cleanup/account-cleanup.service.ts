import fs from "node:fs";
import path from "node:path";

import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { env } from "../../config/env.js";
import { pool } from "../../db/connection.js";
import type { BackupManifest } from "../../ops/backup-manifest.js";
import { hashAuditValue, recordAuditLog } from "../security/audit.service.js";
import { logger } from "../../utils/logger.js";

const CLEANUP_LOCK_NAME = "flowstate:unassigned-account-cleanup";
const SAFE_USER_REFERENCES = new Set([
  "audit_logs.actor_id",
  "password_reset_tokens.user_id",
  "user_notification_preferences.user_id"
]);

export type AccountCleanupMode = "disabled" | "report" | "delete";

interface CandidateRow extends RowDataPacket {
  id: string;
  email: string;
  createdAt: Date;
  liveInviteExpiresAt: Date | null;
}

interface UserReferenceRow extends RowDataPacket {
  tableName: string;
  columnName: string;
}

export interface AccountCleanupResult {
  mode: AccountCleanupMode;
  cutoff: string;
  scanned: number;
  eligible: number;
  protected: number;
  inviteExempt: number;
  anomalySkipped: number;
  deleted: number;
  failed: number;
}

export interface AccountCleanupOptions {
  mode?: AccountCleanupMode;
  now?: Date;
  batchSize?: number;
  requireRecentBackup?: boolean;
}

function parseConfiguredSet(value: string, normalize = false): Set<string> {
  return new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => normalize ? entry.toLowerCase() : entry));
}

function isProtected(candidate: CandidateRow): boolean {
  return parseConfiguredSet(env.UNASSIGNED_ACCOUNT_PROTECTED_USER_IDS).has(candidate.id)
    || parseConfiguredSet(env.UNASSIGNED_ACCOUNT_PROTECTED_EMAILS, true).has(candidate.email.trim().toLowerCase());
}

function escapeIdentifier(value: string): string {
  return `\`${value.replace(/`/g, "``")}\``;
}

function manifestDirectories(): string[] {
  return ["daily", "weekly", "predeploy"].map((kind) => path.join(env.BACKUP_LOCAL_DIR, "manifests", kind));
}

export function findRecentBackup(now = new Date()): { manifestPath: string; createdAt: Date } | null {
  const manifests: Array<{ manifestPath: string; createdAt: Date }> = [];
  for (const directory of manifestDirectories()) {
    if (!fs.existsSync(directory)) continue;
    for (const fileName of fs.readdirSync(directory)) {
      if (!fileName.endsWith(".json")) continue;
      const manifestPath = path.join(directory, fileName);
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupManifest;
        const createdAt = new Date(manifest.createdAt);
        if (!Number.isFinite(createdAt.getTime())) continue;
        if (manifest.verification?.archive !== "verified") continue;
        if (!manifest.archiveSha256) continue;
        if (!manifest.archivePath || !fs.existsSync(manifest.archivePath)) continue;
        if (createdAt.getTime() > now.getTime()) continue;
        manifests.push({ manifestPath, createdAt });
      } catch {
        // Ignore malformed manifests; destructive mode will fail if none qualify.
      }
    }
  }

  manifests.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const latest = manifests[0];
  if (!latest) return null;
  const maxAgeMs = env.UNASSIGNED_ACCOUNT_MAX_BACKUP_AGE_HOURS * 60 * 60 * 1000;
  return now.getTime() - latest.createdAt.getTime() <= maxAgeMs ? latest : null;
}

async function acquireCleanupLock(connection: PoolConnection): Promise<boolean> {
  const [rows] = await connection.query<Array<RowDataPacket & { acquired: number | null }>>(
    "SELECT GET_LOCK(?, 1) AS acquired",
    [CLEANUP_LOCK_NAME]
  );
  return Number(rows[0]?.acquired ?? 0) === 1;
}

async function releaseCleanupLock(connection: PoolConnection): Promise<void> {
  await connection.query("DO RELEASE_LOCK(?)", [CLEANUP_LOCK_NAME]);
}

async function loadUserReferences(connection: PoolConnection): Promise<UserReferenceRow[]> {
  const [rows] = await connection.query<UserReferenceRow[]>(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME = 'users'
        AND REFERENCED_COLUMN_NAME = 'id'`
  );
  return rows;
}

async function findDomainAnomalies(
  connection: PoolConnection,
  userId: string,
  references: UserReferenceRow[]
): Promise<string[]> {
  const anomalies: string[] = [];
  for (const reference of references) {
    const key = `${reference.tableName}.${reference.columnName}`;
    if (SAFE_USER_REFERENCES.has(key)) continue;
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT 1 AS found FROM ${escapeIdentifier(reference.tableName)} WHERE ${escapeIdentifier(reference.columnName)} = ? LIMIT 1`,
      [userId]
    );
    if (rows.length > 0) anomalies.push(key);
  }
  return anomalies.sort();
}

async function selectCandidates(connection: PoolConnection, cutoff: Date, now: Date, limit: number): Promise<CandidateRow[]> {
  const [rows] = await connection.query<CandidateRow[]>(
    `SELECT u.id, u.email, u.created_at AS createdAt,
            (SELECT MAX(i.expires_at) FROM invites i
              WHERE LOWER(i.email) = LOWER(u.email)
                AND i.accepted_at IS NULL
                AND i.revoked_at IS NULL
                AND i.expires_at > ?) AS liveInviteExpiresAt
       FROM users u
      WHERE u.created_at <= ?
        AND NOT EXISTS (
          SELECT 1 FROM workspace_memberships wm WHERE wm.user_id = u.id
        )
      ORDER BY u.created_at ASC, u.id ASC
      LIMIT ?`,
    [now, cutoff, Math.min(limit * 10, 1000)]
  );
  return rows;
}

async function guardedDelete(connection: PoolConnection, candidate: CandidateRow, cutoff: Date, now: Date): Promise<boolean> {
  const [result] = await connection.execute<ResultSetHeader>(
    `DELETE u FROM users u
      WHERE u.id = ?
        AND u.created_at <= ?
        AND NOT EXISTS (SELECT 1 FROM workspace_memberships wm WHERE wm.user_id = u.id)
        AND NOT EXISTS (
          SELECT 1 FROM invites i
           WHERE LOWER(i.email) = LOWER(u.email)
             AND i.accepted_at IS NULL
             AND i.revoked_at IS NULL
             AND i.expires_at > ?
        )`,
    [candidate.id, cutoff, now]
  );
  return result.affectedRows === 1;
}

export async function runAccountCleanup(options: AccountCleanupOptions = {}): Promise<AccountCleanupResult> {
  const mode = options.mode ?? env.UNASSIGNED_ACCOUNT_CLEANUP_MODE;
  const now = options.now ?? new Date();
  const batchSize = Math.min(options.batchSize ?? env.UNASSIGNED_ACCOUNT_CLEANUP_BATCH_SIZE, 100);
  const cutoff = new Date(now.getTime() - env.UNASSIGNED_ACCOUNT_RETENTION_HOURS * 60 * 60 * 1000);
  const result: AccountCleanupResult = {
    mode,
    cutoff: cutoff.toISOString(),
    scanned: 0,
    eligible: 0,
    protected: 0,
    inviteExempt: 0,
    anomalySkipped: 0,
    deleted: 0,
    failed: 0
  };

  if (mode === "disabled") {
    logger.info("accounts.cleanup_disabled", { ...result });
    return result;
  }

  const requireBackup = options.requireRecentBackup ?? env.UNASSIGNED_ACCOUNT_REQUIRE_RECENT_BACKUP;
  if (mode === "delete" && requireBackup && !findRecentBackup(now)) {
    throw new Error("Account cleanup refused: no recent verified local backup manifest was found");
  }

  const connection = await pool.getConnection();
  let locked = false;
  try {
    locked = await acquireCleanupLock(connection);
    if (!locked) throw new Error("Account cleanup is already running");

    const references = await loadUserReferences(connection);
    const candidates = await selectCandidates(connection, cutoff, now, batchSize);

    for (const candidate of candidates) {
      if (result.eligible >= batchSize) break;
      result.scanned += 1;
      if (isProtected(candidate)) {
        result.protected += 1;
        continue;
      }
      if (candidate.liveInviteExpiresAt) {
        result.inviteExempt += 1;
        continue;
      }

      const anomalies = await findDomainAnomalies(connection, candidate.id, references);
      if (anomalies.length > 0) {
        result.anomalySkipped += 1;
        logger.warn("accounts.cleanup_anomaly", {
          accountHash: hashAuditValue(candidate.id),
          references: anomalies
        });
        continue;
      }

      result.eligible += 1;
      if (mode === "report") continue;

      try {
        await connection.beginTransaction();
        const finalAnomalies = await findDomainAnomalies(connection, candidate.id, references);
        if (finalAnomalies.length > 0 || isProtected(candidate)) {
          await connection.rollback();
          result.anomalySkipped += 1;
          continue;
        }
        const deleted = await guardedDelete(connection, candidate, cutoff, now);
        await connection.commit();
        if (deleted) {
          result.deleted += 1;
          await recordAuditLog({
            action: "accounts.cleanup.deleted",
            targetType: "account_hash",
            targetId: hashAuditValue(candidate.id),
            metadata: { createdAt: candidate.createdAt, cutoff }
          });
        }
      } catch (error) {
        await connection.rollback();
        result.failed += 1;
        logger.error("accounts.cleanup_delete_failed", {
          accountHash: hashAuditValue(candidate.id),
          error
        });
      }
    }
  } finally {
    if (locked) await releaseCleanupLock(connection).catch(() => undefined);
    connection.release();
  }

  logger.info("accounts.cleanup_complete", { ...result });
  if (result.failed > 0) throw new Error(`Account cleanup failed for ${result.failed} candidate(s)`);
  return result;
}
