import { Router } from "express";

import { healthRateLimiter } from "../middleware/rate-limit.js";
import { buildLiveHealthPayload, buildReadyHealthPayload } from "../utils/health.js";

export const healthRouter = Router();

healthRouter.use(healthRateLimiter);

healthRouter.get("/live", (_req, res) => {
  res.status(200).json({
    success: true,
    data: buildLiveHealthPayload()
  });
});

healthRouter.get("/ready", async (_req, res) => {
  const payload = await buildReadyHealthPayload();
  const statusCode = payload.ready ? 200 : 503;

  res.status(statusCode).json({
    success: payload.ready,
    data: payload
  });
});

healthRouter.get("/", async (_req, res) => {
  const payload = await buildReadyHealthPayload();
  const statusCode = payload.ready ? 200 : 503;

  res.status(statusCode).json({
    success: payload.ready,
    data: payload
  });
});
