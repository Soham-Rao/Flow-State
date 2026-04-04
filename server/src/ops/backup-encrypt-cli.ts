import { encryptBackupArchive, parseBackupEncryptionEnv } from "./backup-crypto.js";

function getArg(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

const inputPath = getArg("--input");
const outputPath = getArg("--output");

if (!inputPath || !outputPath) {
  console.error("Usage: backup-encrypt-cli --input <archive-path> --output <encrypted-path>");
  process.exit(1);
}

const encryption = parseBackupEncryptionEnv();
if (!encryption.enabled || !encryption.key) {
  console.error("Backup encryption is not enabled");
  process.exit(1);
}

const result = await encryptBackupArchive(inputPath, outputPath, encryption.key);
process.stdout.write(JSON.stringify(result));
