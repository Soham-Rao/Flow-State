import type { NextFunction, Request, Response } from "express";

import { logHttpRequest } from "../utils/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logHttpRequest(req, res, durationMs);
  });

  next();
}
