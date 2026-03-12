import { Router } from "express";

export const healthRouter = Router();

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
