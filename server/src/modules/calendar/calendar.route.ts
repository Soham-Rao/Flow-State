import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { buildCalendarFeed, getCalendarFeeds, regenerateCalendarFeed } from "./calendar.service.js";

export const calendarRouter = Router();

calendarRouter.get("/ics/:token.ics", async (req, res, next) => {
  try {
    const data = await buildCalendarFeed(req.params.token);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(data);
  } catch (error) {
    next(error);
  }
});

calendarRouter.use(requireAuth);

calendarRouter.get("/feeds", async (req, res, next) => {
  try {
    const data = await getCalendarFeeds(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

calendarRouter.post("/feeds/:type/regenerate", async (req, res, next) => {
  try {
    const data = await regenerateCalendarFeed(req.auth!.userId, req.params.type);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
