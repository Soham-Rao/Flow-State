import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { attachments } from "../../db/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { emitBoardEvent } from "../../realtime/socket.js";
import type { BoardAttachment } from "./boards.service.types.js";
import { buildAttachmentStoragePath, ensureAttachmentDirectory, removeFileIfExists, resolveAttachmentPath } from "./boards.service.utils.js";
import { assertCardExists, getAttachmentRecordById, getCardBoardContext } from "./boards.service.lookups.js";

export async function createAttachments(
  cardId: string,
  files: Express.Multer.File[]
): Promise<BoardAttachment[]> {
  assertCardExists(cardId);

  if (!files || files.length === 0) {
    throw new ApiError(400, "No attachments provided");
  }

  const { boardId } = getCardBoardContext(cardId);
  const now = new Date();
  const created: BoardAttachment[] = [];

  for (const file of files) {
    const attachmentId = crypto.randomUUID();
    const originalName = path.basename(file.originalname || "attachment");
    const extension = path.extname(originalName);
    const storedName = `${attachmentId}${extension}`;
    const storagePath = buildAttachmentStoragePath(boardId, cardId, storedName);
    const absolutePath = resolveAttachmentPath(storagePath);

    await ensureAttachmentDirectory(absolutePath);
    await fs.writeFile(absolutePath, file.buffer);

    db.insert(attachments)
      .values({
        id: attachmentId,
        cardId,
        originalName,
        storedName,
        mimeType: file.mimetype ?? null,
        size: file.size ?? 0,
        storagePath,
        createdAt: now
      })
      .run();

    created.push({
      id: attachmentId,
      cardId,
      originalName,
      mimeType: file.mimetype ?? null,
      size: file.size ?? 0,
      createdAt: now
    });
  }

  emitBoardEvent(boardId, {
    boardId,
    type: "attachment.created",
    data: { cardId, attachmentIds: created.map((item) => item.id) }
  });

  return created;
}

export function getAttachmentDownloadInfo(attachmentId: string): { filePath: string; originalName: string } {
  const attachment = getAttachmentRecordById(attachmentId);
  return {
    filePath: resolveAttachmentPath(attachment.storagePath),
    originalName: attachment.originalName
  };
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const attachment = getAttachmentRecordById(attachmentId);
  const { boardId } = getCardBoardContext(attachment.cardId);
  await removeFileIfExists(resolveAttachmentPath(attachment.storagePath));

  const result = db.delete(attachments).where(eq(attachments.id, attachmentId)).run();

  if (result.changes === 0) {
    throw new ApiError(404, "Attachment not found");
  }

  emitBoardEvent(boardId, {
    boardId,
    type: "attachment.deleted",
    data: { cardId: attachment.cardId, attachmentId }
  });
}
