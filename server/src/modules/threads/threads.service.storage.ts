import path from "node:path";
import fs from "node:fs/promises";

const THREAD_UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");

export function buildThreadAttachmentStoragePath(conversationId: string, messageId: string, storedName: string): string {
  return path.join("threads", conversationId, messageId, storedName);
}

export function resolveThreadAttachmentPath(storagePath: string): string {
  return path.join(THREAD_UPLOADS_ROOT, storagePath);
}

export async function ensureThreadAttachmentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export function buildThreadVoiceNoteStoragePath(
  conversationId: string,
  messageId: string,
  voiceNoteId: string,
  extension: string
): string {
  return path.join("threads", conversationId, messageId, "voice", `${voiceNoteId}${extension}`);
}

export function resolveThreadVoiceNotePath(storagePath: string): string {
  return path.join(THREAD_UPLOADS_ROOT, storagePath);
}

export async function ensureThreadVoiceNoteDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export function getVoiceNoteExtension(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname ?? "").toLowerCase();
  if (ext) return ext;
  const mime = (file.mimetype ?? "").toLowerCase();
  if (mime.includes("webm")) return ".webm";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("mpeg")) return ".mp3";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("aac")) return ".aac";
  return ".webm";
}
