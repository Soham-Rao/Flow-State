import fs from "node:fs";

import type { BackupManifest } from "./backup-manifest.js";
import { verifyBackupArtifacts } from "./backup-verify.js";

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

const manifestPath = getArg("--manifest-path");
const archivePathArg = getArg("--archive-path");
const encryptedArchivePathArg = getArg("--encrypted-archive-path");

if (!manifestPath) {
  console.error("Usage: backup-verify-cli --manifest-path <manifest-path> [--archive-path <archive-path>] [--encrypted-archive-path <encrypted-archive-path>]");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupManifest;
try {
  const archivePath = await verifyBackupArtifacts({
    manifest,
    archivePath: archivePathArg,
    encryptedArchivePath: encryptedArchivePathArg
  });

  process.stdout.write(`${archivePath}\n`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Backup verification failed");
  process.exit(1);
}
