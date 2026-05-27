import { Router } from "express";
import multer from "multer";

import { assertBoardPermission } from "../../utils/access-control.js";
import {
  createAttachments,
  deleteAttachment,
  getAttachmentDownloadInfo
} from "./boards.service.js";
import { getAttachmentBoardContext, getCardBoardContext } from "./boards.service.lookups.js";

export const boardsAttachmentsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

boardsAttachmentsRouter.post("/cards/:cardId/attachments", upload.array("files", 10), async (req, res, next) => {
  try {
    const { boardId } = await getCardBoardContext(req.params.cardId);
    await assertBoardPermission(req.auth!.userId, "upload_files", boardId);
    const files = (req.files ?? []) as Express.Multer.File[];
    const data = await createAttachments(req.params.cardId, files);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

boardsAttachmentsRouter.get("/attachments/:attachmentId/download", async (req, res, next) => {
  try {
    const { boardId } = await getAttachmentBoardContext(req.params.attachmentId);
    await assertBoardPermission(req.auth!.userId, "view_boards", boardId);
    const attachment = await getAttachmentDownloadInfo(req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

boardsAttachmentsRouter.delete("/attachments/:attachmentId", async (req, res, next) => {
  try {
    const { boardId } = await getAttachmentBoardContext(req.params.attachmentId);
    await assertBoardPermission(req.auth!.userId, "upload_files", boardId);
    await deleteAttachment(req.params.attachmentId);

    res.status(200).json({
      success: true,
      data: {
        message: "Attachment deleted"
      }
    });
  } catch (error) {
    next(error);
  }
});
