import type { Request } from "express";

export interface SecurityRequestContext {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  method: string;
  path: string;
}

function getUserAgent(req: Request): string | null {
  const value = req.get("user-agent")?.trim();
  return value ? value.slice(0, 512) : null;
}

export function buildSecurityRequestContext(
  req: Request,
  overrides: { actorId?: string | null } = {}
): SecurityRequestContext {
  return {
    actorId: overrides.actorId ?? req.auth?.userId ?? null,
    ip: req.ip ?? null,
    userAgent: getUserAgent(req),
    requestId: req.requestId ?? null,
    method: req.method,
    path: req.originalUrl || req.path
  };
}
