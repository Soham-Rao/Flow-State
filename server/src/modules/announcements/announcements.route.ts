import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { createAnnouncementSchema, deleteAnnouncementsSchema, markAnnouncementsSeenSchema } from "./announcements.schema.js";
import {
  canSendAnnouncements,
  createAnnouncement,
  listAnnouncementAudienceOptions,
  listAnnouncements,
  listUnreadAnnouncements,
  deleteAnnouncementsForUser,
  markAnnouncementsSeen
} from "./announcements.service.js";

export const announcementsRouter = Router();

announcementsRouter.use(requireAuth);

announcementsRouter.get("/capabilities", async (req, res, next) => {
  try {
    const canSend = await canSendAnnouncements(req.auth!.userId);
    res.status(200).json({ success: true, data: { canSend } });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.get("/audience", async (req, res, next) => {
  try {
    const data = await listAnnouncementAudienceOptions(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.get("/", async (req, res, next) => {
  try {
    const data = await listAnnouncements(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.get("/unread", async (req, res, next) => {
  try {
    const data = await listUnreadAnnouncements(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/", async (req, res, next) => {
  try {
    const body = createAnnouncementSchema.parse(req.body);
    const data = await createAnnouncement(body, req.auth!.userId);
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/seen", async (req, res, next) => {
  try {
    const body = markAnnouncementsSeenSchema.parse(req.body);
    await markAnnouncementsSeen(req.auth!.userId, body.ids);
    res.status(200).json({ success: true, data: { ids: body.ids } });
  } catch (error) {
    next(error);
  }
});

announcementsRouter.post("/delete", async (req, res, next) => {
  try {
    const body = deleteAnnouncementsSchema.parse(req.body);
    const ids = await deleteAnnouncementsForUser(req.auth!.userId, body.ids);
    res.status(200).json({ success: true, data: { ids } });
  } catch (error) {
    next(error);
  }
});
