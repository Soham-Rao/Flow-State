import { Router } from "express";
import multer from "multer";

import { requireAuth } from "../../middleware/require-auth.js";
import { setPrivateShortCache } from "../../utils/http-cache.js";
import {
  addChannelMembersSchema,
  createChannelSchema,
  createThreadMessageSchema,
  createThreadReplySchema,
  deleteThreadMessageSchema,
  deleteThreadReplySchema,
  threadMessageListSchema,
  threadReactionSchema,
  updateChannelMemberOverridesSchema,
  updateChannelSchema,
  updateThreadMessageSchema,
  updateThreadReplySchema
} from "./threads.schema.js";
import {
  addChannelMembers,
  createChannelConversation,
  createThreadMessage,
  createThreadReply,
  deleteChannelConversation,
  createThreadAttachments,
  createThreadReplyAttachments,
  createThreadReplyVoiceNote,
  createThreadVoiceNote,
  deleteThreadMessage,
  deleteThreadReply,
  getOrCreateDmConversation,
  getThreadAttachmentDownloadInfo,
  getThreadReplyAttachmentDownloadInfo,
  getThreadReplyVoiceNoteDownloadInfo,
  getThreadVoiceNoteDownloadInfo,
  listChannelConversations,
  listChannelMembers,
  listDmConversations,
  listDmUsers,
  listThreadMessageReactionDetails,
  listThreadMessages,
  listThreadReplyReactionDetails,
  listThreadReplies,
  removeChannelMember,
  toggleThreadMessageReaction,
  toggleThreadReplyReaction,
  updateChannelConversation,
  updateChannelMemberOverrides,
  updateThreadMessage,
  updateThreadReply,
  leaveChannelConversation
} from "./threads.service.js";

export const threadsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

threadsRouter.use(requireAuth);

threadsRouter.get("/dms/users", async (req, res, next) => {
  try {
    const data = await listDmUsers(req.auth!.userId);
    setPrivateShortCache(res, 30, 60);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/dms", async (req, res, next) => {
  try {
    const data = await listDmConversations(req.auth!.userId);
    setPrivateShortCache(res, 6, 15);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/dms/:userId", async (req, res, next) => {
  try {
    const data = await getOrCreateDmConversation(req.auth!.userId, req.params.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/channels", async (req, res, next) => {
  try {
    const data = await listChannelConversations(req.auth!.userId);
    setPrivateShortCache(res, 6, 15);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/channels", async (req, res, next) => {
  try {
    const body = createChannelSchema.parse(req.body ?? {});
    const data = await createChannelConversation(req.auth!.userId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.patch("/channels/:conversationId", async (req, res, next) => {
  try {
    const body = updateChannelSchema.parse(req.body ?? {});
    const data = await updateChannelConversation(req.auth!.userId, req.params.conversationId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/channels/:conversationId/leave", async (req, res, next) => {
  try {
    const data = await leaveChannelConversation(req.auth!.userId, req.params.conversationId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/channels/:conversationId", async (req, res, next) => {
  try {
    const data = await deleteChannelConversation(req.auth!.userId, req.params.conversationId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});


threadsRouter.get("/channels/:conversationId/members", async (req, res, next) => {
  try {
    const data = await listChannelMembers(req.auth!.userId, req.params.conversationId);
    setPrivateShortCache(res, 8, 20);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/channels/:conversationId/members", async (req, res, next) => {
  try {
    const body = addChannelMembersSchema.parse(req.body ?? {});
    const data = await addChannelMembers(req.auth!.userId, req.params.conversationId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.patch("/channels/:conversationId/members/:memberId/overrides", async (req, res, next) => {
  try {
    const body = updateChannelMemberOverridesSchema.parse(req.body ?? {});
    const data = await updateChannelMemberOverrides(req.auth!.userId, req.params.conversationId, req.params.memberId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/channels/:conversationId/members/:memberId", async (req, res, next) => {
  try {
    const data = await removeChannelMember(req.auth!.userId, req.params.conversationId, req.params.memberId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const params = threadMessageListSchema.parse(req.query ?? {});
    const data = await listThreadMessages(req.auth!.userId, req.params.conversationId, params);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/conversations/:conversationId/messages", async (req, res, next) => {
  try {
    const body = createThreadMessageSchema.parse(req.body ?? {});
    const data = await createThreadMessage(req.auth!.userId, req.params.conversationId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.patch("/messages/:messageId", async (req, res, next) => {
  try {
    const body = updateThreadMessageSchema.parse(req.body ?? {});
    const data = await updateThreadMessage(req.auth!.userId, req.params.messageId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/messages/:messageId", async (req, res, next) => {
  try {
    const body = deleteThreadMessageSchema.parse(req.body ?? {});
    const data = await deleteThreadMessage(req.auth!.userId, req.params.messageId, body.scope);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/messages/:messageId/replies", async (req, res, next) => {
  try {
    const params = threadMessageListSchema.parse(req.query ?? {});
    const data = await listThreadReplies(req.auth!.userId, req.params.messageId, params);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/messages/:messageId/replies", async (req, res, next) => {
  try {
    const body = createThreadReplySchema.parse(req.body ?? {});
    const data = await createThreadReply(req.auth!.userId, req.params.messageId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.patch("/replies/:replyId", async (req, res, next) => {
  try {
    const body = updateThreadReplySchema.parse(req.body ?? {});
    const data = await updateThreadReply(req.auth!.userId, req.params.replyId, body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.delete("/replies/:replyId", async (req, res, next) => {
  try {
    const body = deleteThreadReplySchema.parse(req.body ?? {});
    const data = await deleteThreadReply(req.auth!.userId, req.params.replyId, body.scope);
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

threadsRouter.get("/reply-voice-notes/:voiceNoteId/download", async (req, res, next) => {
  try {
    const voiceNote = await getThreadReplyVoiceNoteDownloadInfo(req.auth!.userId, req.params.voiceNoteId);
    res.download(voiceNote.filePath, voiceNote.filename);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/reply-attachments/:attachmentId/download", async (req, res, next) => {
  try {
    const attachment = await getThreadReplyAttachmentDownloadInfo(req.auth!.userId, req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/voice-notes/:voiceNoteId/download", async (req, res, next) => {
  try {
    const voiceNote = await getThreadVoiceNoteDownloadInfo(req.auth!.userId, req.params.voiceNoteId);
    res.download(voiceNote.filePath, voiceNote.filename);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/attachments/:attachmentId/download", async (req, res, next) => {
  try {
    const attachment = await getThreadAttachmentDownloadInfo(req.params.attachmentId);
    res.download(attachment.filePath, attachment.originalName);
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/messages/:messageId/reactions/details", async (req, res, next) => {
  try {
    const data = await listThreadMessageReactionDetails(req.auth!.userId, req.params.messageId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.get("/replies/:replyId/reactions/details", async (req, res, next) => {
  try {
    const data = await listThreadReplyReactionDetails(req.auth!.userId, req.params.replyId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/messages/:messageId/reactions", async (req, res, next) => {
  try {
    const body = threadReactionSchema.parse(req.body ?? {});
    const data = await toggleThreadMessageReaction(req.auth!.userId, req.params.messageId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

threadsRouter.post("/replies/:replyId/reactions", async (req, res, next) => {
  try {
    const body = threadReactionSchema.parse(req.body ?? {});
    const data = await toggleThreadReplyReaction(req.auth!.userId, req.params.replyId, body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

