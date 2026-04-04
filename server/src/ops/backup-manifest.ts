import fs from "node:fs";
import path from "node:path";

export type BackupKind = "predeploy" | "daily" | "weekly";

export interface BackupManifest {
  version: 2;
  backupId: string;
  kind: BackupKind;
  createdAt: string;
  archiveFileName: string;
  archivePath: string;
  archiveSizeBytes: number | null;
  archiveSha256: string | null;
  encryptedArchiveFileName: string | null;
  encryptedArchivePath: string | null;
  encryptedArchiveSizeBytes: number | null;
  encryptedArchiveSha256: string | null;
  currentSha: string;
  targetSha: string | null;
  packageVersion: string | null;
  bunLockHash: string | null;
  migrationJournalHash: string | null;
  mysqlDatabase: string | null;
  compression: "zstd";
  encryption: {
    enabled: boolean;
    algorithm: "aes-256-gcm" | null;
    keyId: string | null;
  };
  verification: {
    archive: "verified" | "missing";
    encryptedArchive: "verified" | "not_applicable" | "missing";
    lastVerifiedAt: string | null;
  };
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
  archiveSha256?: string | null;
  encryptedArchivePath?: string | null;
  encryptedArchiveSha256?: string | null;
  encryptionEnabled?: boolean;
  encryptionKeyId?: string | null;
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
  const encryptedArchivePath = input.encryptedArchivePath ?? null;
  const encryptedArchiveFileName = encryptedArchivePath ? path.basename(encryptedArchivePath) : null;
  const encryptedArchiveSizeBytes = encryptedArchivePath && fs.existsSync(encryptedArchivePath)
    ? fs.statSync(encryptedArchivePath).size
    : null;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const encryptionEnabled = Boolean(input.encryptionEnabled);

  return {
    version: 2,
    backupId: input.backupId,
    kind: input.kind,
    createdAt,
    archiveFileName,
    archivePath: input.archivePath,
    archiveSizeBytes,
    archiveSha256: input.archiveSha256 ?? null,
    encryptedArchiveFileName,
    encryptedArchivePath,
    encryptedArchiveSizeBytes,
    encryptedArchiveSha256: input.encryptedArchiveSha256 ?? null,
    currentSha: input.currentSha,
    targetSha: input.targetSha ?? null,
    packageVersion: input.packageVersion ?? null,
    bunLockHash: input.bunLockHash ?? null,
    migrationJournalHash: input.migrationJournalHash ?? null,
    mysqlDatabase: input.mysqlDatabase ?? null,
    compression: "zstd",
    encryption: {
      enabled: encryptionEnabled,
      algorithm: encryptionEnabled ? "aes-256-gcm" : null,
      keyId: input.encryptionKeyId ?? null
    },
    verification: {
      archive: archiveSizeBytes === null ? "missing" : "verified",
      encryptedArchive: !encryptionEnabled
        ? "not_applicable"
        : encryptedArchiveSizeBytes === null
          ? "missing"
          : "verified",
      lastVerifiedAt: createdAt
    }
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
