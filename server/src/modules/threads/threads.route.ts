import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../../middleware/require-auth.js";
import {
  createThreadMessageSchema,
  createThreadReplySchema,
  updateThreadMessageSchema,
  updateThreadReplySchema,
  deleteThreadMessageSchema,
  deleteThreadReplySchema,
  threadMessageListSchema,
  threadReactionSchema
} from "./threads.schema.js";
import {
  createThreadMessage,
  createThreadReply,
  updateThreadReply,
  deleteThreadReply,
  createThreadAttachments,
  createThreadReplyAttachments,
  createThreadReplyVoiceNote,
  createThreadVoiceNote,
  getThreadReplyVoiceNoteDownloadInfo,
  getThreadReplyAttachmentDownloadInfo,
  getThreadVoiceNoteDownloadInfo,
  getThreadAttachmentDownloadInfo,
  getOrCreateDmConversation,
  listDmConversations,
  listDmUsers,
  listThreadMessages,
  listThreadReplies,
  listThreadMessageReactionDetails,
  listThreadReplyReactionDetails,
  updateThreadMessage,
  deleteThreadMessage,
  toggleThreadMessageReaction,
  toggleThreadReplyReaction
} from "./threads.service.js";

export const threadsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

threadsRouter.use(requireAuth);

threadsRouter.get("/dms/users", (req, res, next) => {
  try {
    const data = listDmUsers(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/dms", (req, res, next) => {
  try {
    const data = listDmConversations(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/dms/:userId", (req, res, next) => {
  try {
    const data = getOrCreateDmConversation(req.auth!.userId, req.params.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/conversations/:conversationId/messages", (req, res, next) => {
  try {
    const params = threadMessageListSchema.parse(req.query ?? {});
    const data = listThreadMessages(req.auth!.userId, req.params.conversationId, params);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/conversations/:conversationId/messages", (req, res, next) => {
  try {
    const body = createThreadMessageSchema.parse(req.body ?? {});
    const data = createThreadMessage(req.auth!.userId, req.params.conversationId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.patch("/messages/:messageId", (req, res, next) => {
  try {
    const body = updateThreadMessageSchema.parse(req.body ?? {});
    const data = updateThreadMessage(req.auth!.userId, req.params.messageId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/messages/:messageId", (req, res, next) => {
  try {
    const body = deleteThreadMessageSchema.parse(req.body ?? {});
    const data = deleteThreadMessage(req.auth!.userId, req.params.messageId, body.scope);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/messages/:messageId/replies", (req, res, next) => {
  try {
    const params = threadMessageListSchema.parse(req.query ?? {});
    const data = listThreadReplies(req.auth!.userId, req.params.messageId, params);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/messages/:messageId/replies", (req, res, next) => {
  try {
    const body = createThreadReplySchema.parse(req.body ?? {});
    const data = createThreadReply(req.auth!.userId, req.params.messageId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.patch("/replies/:replyId", (req, res, next) => {
  try {
    const body = updateThreadReplySchema.parse(req.body ?? {});
    const data = updateThreadReply(req.auth!.userId, req.params.replyId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/replies/:replyId", (req, res, next) => {
  try {
    const body = deleteThreadReplySchema.parse(req.body ?? {});
    const data = deleteThreadReply(req.auth!.userId, req.params.replyId, body.scope);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/messages/:messageId/attachments", upload.array("files", 10), async (req, res, next) => {
  try {
    const files = (req.files ?? []) as Express.Multer.File[];
    const data = await createThreadAttachments(req.auth!.userId, req.params.messageId, files);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/messages/:messageId/voice-note", upload.single("voice"), async (req, res, next) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    const durationSec = Number(req.body?.durationSec ?? 0);
    const data = await createThreadVoiceNote(req.auth!.userId, req.params.messageId, file, durationSec);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/replies/:replyId/attachments", upload.array("files", 10), async (req, res, next) => {
  try {
    const files = (req.files ?? []) as Express.Multer.File[];
    const data = await createThreadReplyAttachments(req.auth!.userId, req.params.replyId, files);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/replies/:replyId/voice-note", upload.single("voice"), async (req, res, next) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    const durationSec = Number(req.body?.durationSec ?? 0);
    const data = await createThreadReplyVoiceNote(req.auth!.userId, req.params.replyId, file, durationSec);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/reply-voice-notes/:voiceNoteId/download", (req, res, next) => {
  try {
    const voiceNote = getThreadReplyVoiceNoteDownloadInfo(req.auth!.userId, req.params.voiceNoteId);
    res.download(voiceNote.filePath, voiceNote.filename);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/reply-attachments/:attachmentId/download", (req, res, next) => {
  try {
    const attachment = getThreadReplyAttachmentDownloadInfo(req.auth!.userId, req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/voice-notes/:voiceNoteId/download", (req, res, next) => {
  try {
    const voiceNote = getThreadVoiceNoteDownloadInfo(req.auth!.userId, req.params.voiceNoteId);
    res.download(voiceNote.filePath, voiceNote.filename);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/attachments/:attachmentId/download", (req, res, next) => {
  try {
    const attachment = getThreadAttachmentDownloadInfo(req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/messages/:messageId/reactions/details", (req, res, next) => {
  try {
    const data = listThreadMessageReactionDetails(req.auth!.userId, req.params.messageId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/replies/:replyId/reactions/details", (req, res, next) => {
  try {
    const data = listThreadReplyReactionDetails(req.auth!.userId, req.params.replyId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/messages/:messageId/reactions", (req, res, next) => {
  try {
    const body = threadReactionSchema.parse(req.body ?? {});
    const data = toggleThreadMessageReaction(req.auth!.userId, req.params.messageId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/replies/:replyId/reactions", (req, res, next) => {
  try {
    const body = threadReactionSchema.parse(req.body ?? {});
    const data = toggleThreadReplyReaction(req.auth!.userId, req.params.replyId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
