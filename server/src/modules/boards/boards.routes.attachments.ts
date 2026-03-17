import { Router } from "express";
import multer from "multer";

import { assertPermission } from "../../utils/permissions.js";
import {
  createAttachments,
  deleteAttachment,
  getAttachmentDownloadInfo
} from "./boards.service.js";

export const boardsAttachmentsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

boardsAttachmentsRouter.post("/cards/:cardId/attachments", upload.array("files", 10), async (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "upload_files");
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

boardsAttachmentsRouter.get("/attachments/:attachmentId/download", (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "view_boards");
    const attachment = getAttachmentDownloadInfo(req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

boardsAttachmentsRouter.delete("/attachments/:attachmentId", async (req, res, next) => {
  try {
    assertPermission(req.auth!.userId, "upload_files");
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
