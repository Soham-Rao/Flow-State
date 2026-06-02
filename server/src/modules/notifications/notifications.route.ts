import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import {
  assertReminderEmailPreference,
  getNotificationPreferences,
  updateNotificationPreferences
} from "./notifications.service.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/preferences", async (req, res, next) => {
  try {
    const data = await getNotificationPreferences(req.auth!.userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.patch("/preferences", async (req, res, next) => {
  try {
    assertReminderEmailPreference(req.body);
    const data = await updateNotificationPreferences(req.auth!.userId, req.body);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
