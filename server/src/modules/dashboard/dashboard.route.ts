import { Router } from "express";

import { requireAuth } from "../../middleware/require-auth.js";
import { setPrivateShortCache } from "../../utils/http-cache.js";
import { getDashboardSummary } from "./dashboard.service.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    const data = await getDashboardSummary(req.auth!.userId);
    setPrivateShortCache(res, 12, 24);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
