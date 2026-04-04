import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { recordAuditLog } from "../modules/security/audit.service.js";
import { buildSecurityRequestContext } from "../utils/request-context.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/api-error.js";

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const context = buildSecurityRequestContext(req);

  if (error instanceof ApiError) {
    if (error.statusCode === 403) {
      void recordAuditLog({
        actorId: context.actorId,
        action: "security.permission_denied",
        targetType: "route",
        targetId: context.path,
        ip: context.ip,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: {
          method: context.method,
          path: context.path
        }
      });
    }

    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        details: error.details ?? null
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    const firstPath = firstIssue?.path.join(".");
    const validationMessage =
      firstIssue && firstPath
        ? `${firstPath}: ${firstIssue.message}`
        : firstIssue?.message ?? "Invalid request payload";

    res.status(400).json({
      success: false,
      error: {
        message: validationMessage,
        details: error.flatten()
      }
    });
    return;
  }

  logger.error("http.unhandled_error", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    actorId: context.actorId,
    error,
    stack: env.NODE_ENV === "production" ? undefined : error.stack
  });

  const message = env.NODE_ENV === "production" ? "Internal server error" : error.message;

  res.status(500).json({
    success: false,
    error: {
      message
    }
  });
}
