import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildArchiveFileName,
  buildBackupId,
  buildBackupManifest,
  buildManifestFileName,
  selectEntriesToPrune,
  shouldRestoreDatabase
} from "../src/ops/backup-manifest.js";
import { computeFileSha256, getBackupArchiveExtension, parseBackupEncryptionKey } from "../src/ops/backup-crypto.js";
import { verifyBackupArtifacts } from "../src/ops/backup-verify.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("backup manifest helpers", () => {
  it("builds stable backup file names", () => {
    const createdAt = new Date("2026-04-04T12:34:56.000Z");
    const backupId = buildBackupId("predeploy", "abcdef123456", createdAt);

    expect(backupId).toBe("20260404T123456Z-predeploy-abcdef1");
    expect(buildArchiveFileName(backupId)).toBe("20260404T123456Z-predeploy-abcdef1.sql.zst");
    expect(buildManifestFileName(backupId)).toBe("20260404T123456Z-predeploy-abcdef1.json");
  });

  it("prunes the oldest entries after the keep count", () => {
    const result = selectEntriesToPrune([
      "20260404T120000Z-predeploy-bbbbbbb.sql.zst",
      "20260403T120000Z-predeploy-aaaaaaa.sql.zst",
      "20260402T120000Z-predeploy-9999999.sql.zst"
    ], 2);

    expect(result).toEqual(["20260402T120000Z-predeploy-9999999.sql.zst"]);
  });

  it("decides whether a rollback should restore the database", () => {
    expect(shouldRestoreDatabase("always", false)).toBe(true);
    expect(shouldRestoreDatabase("never", true)).toBe(false);
    expect(shouldRestoreDatabase("auto", true)).toBe(true);
    expect(shouldRestoreDatabase("auto", false)).toBe(false);
  });

  it("records checksum and encryption metadata in backup manifests", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flowstate-manifest-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "backup.sql.zst");
    const encryptedPath = path.join(dir, "backup.sql.zst.enc");
    fs.writeFileSync(archivePath, "plain backup");
    fs.writeFileSync(encryptedPath, "encrypted backup");

    const manifest = buildBackupManifest({
      backupId: "20260405T120000Z-daily-abcdef1",
      kind: "daily",
      archivePath,
      archiveSha256: "archive-sha",
      encryptedArchivePath: encryptedPath,
      encryptedArchiveSha256: "encrypted-sha",
      encryptionEnabled: true,
      encryptionKeyId: "primary-key",
      currentSha: "abcdef1234567",
      packageVersion: "0.1.0"
    });

    expect(manifest.version).toBe(2);
    expect(manifest.archiveSha256).toBe("archive-sha");
    expect(manifest.encryptedArchiveSha256).toBe("encrypted-sha");
    expect(manifest.encryption).toEqual({
      enabled: true,
      algorithm: "aes-256-gcm",
      keyId: "primary-key"
    });
    expect(manifest.verification.archive).toBe("verified");
    expect(manifest.verification.encryptedArchive).toBe("verified");
  });

  it("allows manifest verification when encrypted archive metadata points to remote storage", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flowstate-remote-manifest-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "backup.sql.zst");
    fs.writeFileSync(archivePath, "plain backup");
    const archiveSha = await computeFileSha256(archivePath);

    const manifest = buildBackupManifest({
      backupId: "20260405T120000Z-daily-abcdef1",
      kind: "daily",
      archivePath,
      archiveSha256: archiveSha,
      encryptedArchivePath: "s3://flowstate-backups/flowstate/daily/backup.sql.zst.enc",
      encryptedArchiveSha256: "remote-sha",
      encryptionEnabled: true,
      encryptionKeyId: "primary-key",
      currentSha: "abcdef1234567"
    });

    await expect(verifyBackupArtifacts({ manifest })).resolves.toBe(archivePath);
  });

  it("fails verification when a local encrypted archive path is missing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flowstate-local-manifest-"));
    tempDirs.push(dir);
    const archivePath = path.join(dir, "backup.sql.zst");
    fs.writeFileSync(archivePath, "plain backup");
    const archiveSha = await computeFileSha256(archivePath);

    const manifest = buildBackupManifest({
      backupId: "20260405T120000Z-daily-abcdef1",
      kind: "daily",
      archivePath,
      archiveSha256: archiveSha,
      encryptedArchivePath: path.join(dir, "missing.sql.zst.enc"),
      encryptedArchiveSha256: "missing-sha",
      encryptionEnabled: true,
      encryptionKeyId: "primary-key",
      currentSha: "abcdef1234567"
    });

    await expect(verifyBackupArtifacts({ manifest })).rejects.toThrow(/Encrypted archive not found/i);
  });
});

describe("backup crypto helpers", () => {
  it("parses hex and base64 backup keys", () => {
    const hex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const base64 = Buffer.from(hex, "hex").toString("base64");

    expect(parseBackupEncryptionKey(hex)).toHaveLength(32);
    expect(parseBackupEncryptionKey(base64)).toHaveLength(32);
  });

  it("computes stable file checksums", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flowstate-checksum-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "sample.txt");
    fs.writeFileSync(filePath, "hello checksum");

    const sha = await computeFileSha256(filePath);
    expect(sha).toBe("2187766ebb93f57fbcb53b559a612bc2f95c4bc306abf35dfa13e7e7ead58ce0");
  });

  it("returns the correct backup archive extension", () => {
    expect(getBackupArchiveExtension(true)).toBe(".sql.zst.enc");
    expect(getBackupArchiveExtension(false)).toBe(".sql.zst");
  });
});
