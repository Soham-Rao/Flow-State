import crypto from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const existing = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : null;
  const id = existing ?? crypto.randomUUID();

  req.requestId = id;
  res.setHeader("x-request-id", id);
  next();
}
