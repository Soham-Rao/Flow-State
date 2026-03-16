import crypto from "node:crypto";

const ENCRYPTION_VERSION = 1;
const ENCRYPTION_ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function resolveKey(): Buffer {
  const rawKey = process.env.FLOWSTATE_DM_ENCRYPTION_KEY?.trim();
  if (!rawKey) {
    throw new Error("FLOWSTATE_DM_ENCRYPTION_KEY is not set");
  }

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    key = Buffer.from(rawKey, "hex");
  } else {
    key = Buffer.from(rawKey, "base64");
  }

  if (key.length !== 32) {
    throw new Error("FLOWSTATE_DM_ENCRYPTION_KEY must be 32 bytes (base64 or hex)");
  }

  return key;
}

export function encryptDmBody(plaintext: string): { payload: string; version: number } {
  const key = resolveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([Buffer.from([ENCRYPTION_VERSION]), iv, tag, ciphertext]).toString("base64");
  return { payload, version: ENCRYPTION_VERSION };
}

export function decryptDmBody(payload: string, version: number): string {
  if (version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }
  const buffer = Buffer.from(payload, "base64");
  if (buffer.length <= 1 + IV_LENGTH + TAG_LENGTH) {
    throw new Error("Encrypted payload is invalid");
  }
  const payloadVersion = buffer.readUInt8(0);
  if (payloadVersion !== ENCRYPTION_VERSION) {
    throw new Error(`Encrypted payload version mismatch: ${payloadVersion}`);
  }
  const iv = buffer.subarray(1, 1 + IV_LENGTH);
  const tag = buffer.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const ciphertext = buffer.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const key = resolveKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
