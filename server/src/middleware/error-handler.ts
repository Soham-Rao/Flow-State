import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ApiError) {
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

  const message = env.NODE_ENV === "production" ? "Internal server error" : error.message;

  res.status(500).json({
    success: false,
    error: {
      message
    }
  });
}
