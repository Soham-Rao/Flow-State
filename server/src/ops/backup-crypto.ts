import crypto from "node:crypto";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

const BACKUP_MAGIC = Buffer.from("FSBK1");
const IV_LENGTH = 12;
const BACKUP_ALGORITHM = "aes-256-gcm";

export interface BackupEncryptionConfig {
  enabled: boolean;
  key: Buffer | null;
  keyId: string | null;
}

export interface BackupEncryptionResult {
  algorithm: typeof BACKUP_ALGORITHM;
  sizeBytes: number;
  sha256: string;
}

function isHexKey(value: string): boolean {
  return value.length === 64 && /^[0-9a-fA-F]+$/.test(value);
}

function isBase64Key(value: string): boolean {
  return value.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(value);
}

export function parseBackupEncryptionKey(rawValue: string): Buffer {
  const normalized = rawValue.trim();
  if (isHexKey(normalized)) {
    return Buffer.from(normalized, "hex");
  }
  if (isBase64Key(normalized)) {
    return Buffer.from(normalized, "base64");
  }
  throw new Error("Backup encryption key must be a 32-byte key as 64 hex or 44 base64");
}

export function parseBackupEncryptionEnv(
  source: NodeJS.ProcessEnv = process.env
): BackupEncryptionConfig {
  const enabled = source.BACKUP_ENCRYPTION_ENABLED === "true";
  if (!enabled) {
    return {
      enabled: false,
      key: null,
      keyId: source.BACKUP_ENCRYPTION_KEY_ID?.trim() || null
    };
  }

  const rawKey = source.BACKUP_ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new Error("BACKUP_ENCRYPTION_KEY is required when BACKUP_ENCRYPTION_ENABLED=true");
  }

  return {
    enabled: true,
    key: parseBackupEncryptionKey(rawKey),
    keyId: source.BACKUP_ENCRYPTION_KEY_ID?.trim() || null
  };
}

export async function computeFileSha256(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const input = fs.createReadStream(filePath);

  for await (const chunk of input) {
    hash.update(chunk as Buffer);
  }

  return hash.digest("hex");
}

export async function encryptBackupArchive(inputPath: string, outputPath: string, key: Buffer): Promise<BackupEncryptionResult> {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(BACKUP_ALGORITHM, key, iv);
  const output = fs.createWriteStream(outputPath);
  output.write(BACKUP_MAGIC);
  output.write(iv);

  await pipeline(fs.createReadStream(inputPath), cipher, output, { end: false });

  output.write(cipher.getAuthTag());
  await new Promise<void>((resolve, reject) => {
    output.end((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  const stats = await fs.promises.stat(outputPath);
  const sha256 = await computeFileSha256(outputPath);

  return {
    algorithm: BACKUP_ALGORITHM,
    sizeBytes: stats.size,
    sha256
  };
}

export function getBackupArchiveExtension(encryptionEnabled: boolean): string {
  return encryptionEnabled ? ".sql.zst.enc" : ".sql.zst";
}

