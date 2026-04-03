import { Router } from "express";

import { healthRateLimiter } from "../middleware/rate-limit.js";

export const healthRouter = Router();

healthRouter.use(healthRateLimiter);

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      service: "flowstate-server",
      status: "ok",
      timestamp: new Date().toISOString()
    }
  });
});
