import fs from "node:fs";

import type { BackupManifest } from "./backup-manifest.js";
import { computeFileSha256 } from "./backup-crypto.js";

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
const archivePath = archivePathArg ?? manifest.archivePath;

if (!archivePath || !fs.existsSync(archivePath)) {
  console.error(`Archive not found: ${archivePath}`);
  process.exit(1);
}

const archiveSha = await computeFileSha256(archivePath);
if (manifest.archiveSha256 && archiveSha !== manifest.archiveSha256) {
  console.error("Archive checksum mismatch");
  process.exit(1);
}

const encryptedArchivePath = encryptedArchivePathArg ?? manifest.encryptedArchivePath;
if (encryptedArchivePath && manifest.encryptedArchiveSha256) {
  if (!fs.existsSync(encryptedArchivePath)) {
    console.error(`Encrypted archive not found: ${encryptedArchivePath}`);
    process.exit(1);
  }

  const encryptedSha = await computeFileSha256(encryptedArchivePath);
  if (encryptedSha !== manifest.encryptedArchiveSha256) {
    console.error("Encrypted archive checksum mismatch");
    process.exit(1);
  }
}

process.stdout.write(`${archivePath}\n`);
