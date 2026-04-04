import fs from "node:fs";

import type { BackupManifest } from "./backup-manifest.js";
import { computeFileSha256 } from "./backup-crypto.js";

function isRemoteBackupPath(filePath: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(filePath);
}

export async function verifyBackupArtifacts(input: {
  manifest: BackupManifest;
  archivePath?: string | null;
  encryptedArchivePath?: string | null;
}): Promise<string> {
  const archivePath = input.archivePath ?? input.manifest.archivePath;
  if (!archivePath || !fs.existsSync(archivePath)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }

  const archiveSha = await computeFileSha256(archivePath);
  if (input.manifest.archiveSha256 && archiveSha !== input.manifest.archiveSha256) {
    throw new Error("Archive checksum mismatch");
  }

  const encryptedArchivePath = input.encryptedArchivePath ?? input.manifest.encryptedArchivePath;
  if (encryptedArchivePath && input.manifest.encryptedArchiveSha256) {
    const shouldVerifyEncryptedArchive =
      Boolean(input.encryptedArchivePath) || !isRemoteBackupPath(encryptedArchivePath);

    if (shouldVerifyEncryptedArchive) {
      if (!fs.existsSync(encryptedArchivePath)) {
        throw new Error(`Encrypted archive not found: ${encryptedArchivePath}`);
      }

      const encryptedSha = await computeFileSha256(encryptedArchivePath);
      if (encryptedSha !== input.manifest.encryptedArchiveSha256) {
        throw new Error("Encrypted archive checksum mismatch");
      }
    }
  }

  return archivePath;
}
