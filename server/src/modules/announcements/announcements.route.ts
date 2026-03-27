import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { createAnnouncementSchema, markAnnouncementsSeenSchema } from "./announcements.schema.js";
import {
  canSendAnnouncements,
  createAnnouncement,
  listAnnouncementAudienceOptions,
  listUnreadAnnouncements,
  markAnnouncementsSeen
} from "./announcements.service.js";

export const announcementsRouter = Router();

announcementsRouter.use(requireAuth);

announcementsRouter.get("/capabilities", (req, res, next) => {
  try {
    const canSend = canSendAnnouncements(req.auth!.userId);
    res.status(200).json({ success: true, data: { canSend } });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.get("/audience", (req, res, next) => {
  try {
    const data = listAnnouncementAudienceOptions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.get("/unread", (req, res, next) => {
  try {
    const data = listUnreadAnnouncements(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/", (req, res, next) => {
  try {
    const body = createAnnouncementSchema.parse(req.body);
    const data = createAnnouncement(body, req.auth!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/seen", (req, res, next) => {
  try {
    const body = markAnnouncementsSeenSchema.parse(req.body);
    markAnnouncementsSeen(req.auth!.userId, body.ids);
    res.status(200).json({ success: true, data: { ids: body.ids } });
  } catch (error) {
    next(error);
  }
});
