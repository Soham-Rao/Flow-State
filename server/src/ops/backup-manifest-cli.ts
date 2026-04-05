import fs from "node:fs";
import path from "node:path";

import { getPendingMigrationInventory } from "../db/migration-guard.js";
import { buildBackupManifest, type BackupKind } from "./backup-manifest.js";

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

const kind = getArg("--kind") as BackupKind | null;
const archivePath = getArg("--archive-path");
const currentSha = getArg("--current-sha");
const backupId = getArg("--backup-id");
const manifestPath = getArg("--manifest-path");
const targetSha = getArg("--target-sha");
const packageVersion = getArg("--package-version");
const bunLockHash = getArg("--bun-lock-hash");
const migrationJournalHash = getArg("--migration-journal-hash");
const mysqlDatabase = getArg("--mysql-database");
const archiveSha256 = getArg("--archive-sha256");
const encryptedArchivePath = getArg("--encrypted-archive-path");
const encryptedArchiveSha256 = getArg("--encrypted-archive-sha256");
const backupEncryptionEnabled = getArg("--backup-encryption-enabled");
const backupEncryptionKeyId = getArg("--backup-encryption-key-id");

if (!kind || !archivePath || !currentSha || !backupId || !manifestPath) {
  console.error("Missing required args for backup manifest creation");
  process.exit(1);
}

const inventory = await getPendingMigrationInventory(path.resolve("server/drizzle"));
const manifest = buildBackupManifest({
  backupId,
  kind,
  archivePath,
  archiveSha256,
  encryptedArchivePath,
  encryptedArchiveSha256,
  encryptionEnabled: backupEncryptionEnabled === "true",
  encryptionKeyId: backupEncryptionKeyId,
  currentSha,
  targetSha,
  packageVersion,
  bunLockHash,
  migrationJournalHash,
  migrationPendingFiles: inventory.pendingMigrations.map((migration) => migration.fileName),
  migrationRiskyFiles: inventory.riskyMigrations.map((migration) => migration.fileName),
  migrationAcknowledgedRiskyFiles: inventory.acknowledgedRiskyMigrations.map((migration) => migration.fileName),
  mysqlDatabase
});

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
process.stdout.write(`${path.resolve(manifestPath)}\n`);
