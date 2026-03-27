import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
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

mentionsRouter.use(requireAuth);

mentionsRouter.get("/unread", (req, res, next) => {
  try {
    const data = getUnreadMentions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.get("/comments/unread", (req, res, next) => {
  try {
    const data = listUnreadCommentMentions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.get("/threads/unread", (req, res, next) => {
  try {
    const data = listUnreadThreadMentions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/comments/seen", (req, res, next) => {
  try {
    const body = markCommentMentionsSchema.parse(req.body ?? {});
    markCommentMentionsSeen(req.auth!.userId, body.commentIds);
    res.status(200).json({ success: true, data: { message: "Comment mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/seen", (req, res, next) => {
  try {
    const body = markThreadMentionsSchema.parse(req.body ?? {});
    markThreadMentionsSeen(req.auth!.userId, body.conversationId);
    res.status(200).json({ success: true, data: { message: "Thread mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/messages/seen", (req, res, next) => {
  try {
    const body = markThreadMessageMentionsSchema.parse(req.body ?? {});
    markThreadMessageMentionsSeen(req.auth!.userId, body.messageIds);
    res.status(200).json({ success: true, data: { message: "Thread message mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/replies/seen", (req, res, next) => {
  try {
    const body = markThreadReplyMentionsSchema.parse(req.body ?? {});
    markThreadReplyMentionsSeen(req.auth!.userId, body.messageId);
    res.status(200).json({ success: true, data: { message: "Thread reply mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});

mentionsRouter.post("/threads/replies/seen-by-id", (req, res, next) => {
  try {
    const body = markThreadReplyMentionIdsSchema.parse(req.body ?? {});
    markThreadReplyMentionIdsSeen(req.auth!.userId, body.replyIds);
    res.status(200).json({ success: true, data: { message: "Thread reply mentions marked as seen" } });
  } catch (error) {
    next(error);
  }
});
