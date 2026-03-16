import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { markCommentMentionsSchema, markThreadMentionsSchema } from "./mentions.schema.js";
import { getUnreadMentions, markCommentMentionsSeen, markThreadMentionsSeen } from "./mentions.service.js";

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
