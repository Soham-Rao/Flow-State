import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { requireWorkspace } from "../../middleware/require-workspace.js";
import { markCommentMentionsSchema, markThreadMentionsSchema, markThreadMessageMentionsSchema, markThreadReplyMentionsSchema, markThreadReplyMentionIdsSchema } from "./mentions.schema.js";
import {
  getUnreadMentions,
  listUnreadCommentMentions,
  listUnreadThreadMentions,
  markCommentMentionsSeen,
  markThreadMentionsSeen,
  markThreadMessageMentionsSeen,
  markThreadReplyMentionsSeen,
  markThreadReplyMentionIdsSeen
} from "./mentions.service.js";

export const mentionsRouter = Router();

mentionsRouter.use(requireAuth, requireWorkspace);

mentionsRouter.get("/unread", async (req, res, next) => {
  try {
    const data = await getUnreadMentions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.get("/comments/unread", async (req, res, next) => {
  try {
    const data = await listUnreadCommentMentions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.get("/threads/unread", async (req, res, next) => {
  try {
    const data = await listUnreadThreadMentions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/comments/seen", async (req, res, next) => {
  try {
    const body = markCommentMentionsSchema.parse(req.body ?? {});
    await markCommentMentionsSeen(req.auth!.userId, body.commentIds);
    res.status(200).json({ success: true, data: { message: "Comment mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/seen", async (req, res, next) => {
  try {
    const body = markThreadMentionsSchema.parse(req.body ?? {});
    await markThreadMentionsSeen(req.auth!.userId, body.conversationId);
    res.status(200).json({ success: true, data: { message: "Thread mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/messages/seen", async (req, res, next) => {
  try {
    const body = markThreadMessageMentionsSchema.parse(req.body ?? {});
    await markThreadMessageMentionsSeen(req.auth!.userId, body.messageIds);
    res.status(200).json({ success: true, data: { message: "Thread message mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/replies/seen", async (req, res, next) => {
  try {
    const body = markThreadReplyMentionsSchema.parse(req.body ?? {});
    await markThreadReplyMentionsSeen(req.auth!.userId, body.messageId);
    res.status(200).json({ success: true, data: { message: "Thread reply mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/replies/seen-by-id", async (req, res, next) => {
  try {
    const body = markThreadReplyMentionIdsSchema.parse(req.body ?? {});
    await markThreadReplyMentionIdsSeen(req.auth!.userId, body.replyIds);
    res.status(200).json({ success: true, data: { message: "Thread reply mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});
