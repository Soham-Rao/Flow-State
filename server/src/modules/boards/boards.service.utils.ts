import path from "node:path";
import fs from "node:fs/promises";

import type { CardCoverColor } from "../../db/schema.js";
import { UPLOADS_ROOT } from "./boards.service.types.js";

export function normalizeOptionalDescription(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function clampIndex(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function normalizeDueDate(value: Date | null | undefined): Date | null | undefined {
  if (!value) return null;
  const millis = value.getTime();
  return Number.isNaN(millis) ? null : new Date(millis);
}

export function normalizeCoverColor(value: CardCoverColor | null | undefined): CardCoverColor | null | undefined {
  if (value === undefined) return undefined;
  return value ?? null;
}

export function resolveRestoredName(name: string, existing: Set<string>): string {
  let suffix = 1;
  let nextName = `${name} (restored)`;
  while (existing.has(nextName)) {
    suffix += 1;
    nextName = `${name} (restored ${suffix})`;
  }
  return nextName;
}

export function clampRetentionMinutes(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(1, Math.round(value));
}

export function clampArchiveRetentionMinutes(value: number | undefined): number {
  if (!value || Number.isNaN(value)) {
    return 0;
  }
  return Math.max(1, Math.round(value));
}

export function buildAttachmentStoragePath(boardId: string, cardId: string, storedName: string): string {
  return path.join("boards", boardId, cardId, storedName);
}

export function resolveAttachmentPath(storagePath: string): string {
  return path.join(UPLOADS_ROOT, storagePath);
}

export async function ensureAttachmentDirectory(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}
