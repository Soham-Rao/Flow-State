import fs from "node:fs";
import path from "node:path";

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

if (!kind || !archivePath || !currentSha || !backupId || !manifestPath) {
  console.error("Missing required args for backup manifest creation");
  process.exit(1);
}

const manifest = buildBackupManifest({
  backupId,
  kind,
  archivePath,
  currentSha,
  targetSha,
  packageVersion,
  bunLockHash,
  migrationJournalHash,
  mysqlDatabase
});

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
process.stdout.write(`${path.resolve(manifestPath)}
`);
