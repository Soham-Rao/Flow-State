import fs from "node:fs";
import path from "node:path";

export type BackupKind = "predeploy" | "daily" | "weekly";

export interface BackupManifest {
  version: 1;
  backupId: string;
  kind: BackupKind;
  createdAt: string;
  archiveFileName: string;
  archivePath: string;
  archiveSizeBytes: number | null;
  currentSha: string;
  targetSha: string | null;
  packageVersion: string | null;
  bunLockHash: string | null;
  migrationJournalHash: string | null;
  mysqlDatabase: string | null;
  compression: "zstd";
}

export function buildBackupId(kind: BackupKind, currentSha: string, createdAt = new Date()): string {
  const stamp = createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${stamp}-${kind}-${currentSha.slice(0, 7)}`;
}

export function buildArchiveFileName(backupId: string): string {
  return `${backupId}.sql.zst`;
}

export function buildManifestFileName(backupId: string): string {
  return `${backupId}.json`;
}

export function buildBackupManifest(input: {
  backupId: string;
  kind: BackupKind;
  archivePath: string;
  currentSha: string;
  targetSha?: string | null;
  packageVersion?: string | null;
  bunLockHash?: string | null;
  migrationJournalHash?: string | null;
  mysqlDatabase?: string | null;
  createdAt?: string;
}): BackupManifest {
  const archiveFileName = path.basename(input.archivePath);
  const archiveSizeBytes = fs.existsSync(input.archivePath) ? fs.statSync(input.archivePath).size : null;

  return {
    version: 1,
    backupId: input.backupId,
    kind: input.kind,
    createdAt: input.createdAt ?? new Date().toISOString(),
    archiveFileName,
    archivePath: input.archivePath,
    archiveSizeBytes,
    currentSha: input.currentSha,
    targetSha: input.targetSha ?? null,
    packageVersion: input.packageVersion ?? null,
    bunLockHash: input.bunLockHash ?? null,
    migrationJournalHash: input.migrationJournalHash ?? null,
    mysqlDatabase: input.mysqlDatabase ?? null,
    compression: "zstd"
  };
}

export function selectEntriesToPrune(entries: string[], keep: number): string[] {
  const sorted = [...entries].sort().reverse();
  return sorted.slice(Math.max(keep, 0));
}

export function shouldRestoreDatabase(mode: "auto" | "always" | "never", dbChanged: boolean): boolean {
  if (mode === "always") return true;
  if (mode === "never") return false;
  return dbChanged;
}
