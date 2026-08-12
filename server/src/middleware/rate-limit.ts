import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { recordAuditLog } from "../modules/security/audit.service.js";
import { buildSecurityRequestContext } from "../utils/request-context.js";

function resolveMax(value: number): number {
  return env.NODE_ENV === "test" ? Math.max(value, 1000) : value;
}

function buildRateLimitResponse(res: Response, message: string): void {
  res.status(429).json({
    success: false,
    error: {
      message
    }
  });
}

function createJsonRateLimiter(options: {
  action: string;
  message: string;
  windowMs: number;
  max: number;
  targetType?: string;
}): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: options.windowMs,
    max: resolveMax(options.max),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (req, res) => {
      const context = buildSecurityRequestContext(req as Request);
      void recordAuditLog({
        actorId: context.actorId,
        action: `rate_limit.${options.action}`,
        targetType: options.targetType ?? "route",
        targetId: context.path,
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          method: context.method,
          path: context.path
        }
      });

      buildRateLimitResponse(res as Response, options.message);
    }
  });
}

export const loginRateLimiter = createJsonRateLimiter({
  action: "auth.login",
  message: "Too many login attempts. Please try again later.",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX
});

export const registerRateLimiter = createJsonRateLimiter({
  action: "auth.register",
  message: "Too many registration attempts. Please try again later.",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX
});

export const forgotPasswordRateLimiter = createJsonRateLimiter({
  action: "auth.forgot_password",
  message: "Too many password reset requests. Please try again later.",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX
});

export const resetPasswordRateLimiter = createJsonRateLimiter({
  action: "auth.reset_password",
  message: "Too many password reset attempts. Please try again later.",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX
});

export const inviteLookupRateLimiter = createJsonRateLimiter({
  action: "invites.lookup",
  message: "Too many invite lookups. Please try again later.",
  windowMs: env.PUBLIC_RATE_LIMIT_WINDOW_MS,
  max: env.PUBLIC_RATE_LIMIT_MAX
});

export const healthRateLimiter = createJsonRateLimiter({
  action: "health",
  message: "Too many health checks. Please try again later.",
  windowMs: env.HEALTH_RATE_LIMIT_WINDOW_MS,
  max: env.HEALTH_RATE_LIMIT_MAX,
  targetType: "health"
});

export const workspaceCreationRateLimiter = createJsonRateLimiter({
  action: "workspace.create",
  message: "Too many workspace creation attempts. Please try again later.",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: Math.min(env.AUTH_RATE_LIMIT_MAX, 5),
  targetType: "workspace"
});
