import sanitizeHtml from "sanitize-html";

import { ApiError } from "./api-error.js";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: "discard"
};

function normalizeRawText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u2028\u2029]/g, "");
}

export function sanitizePlainText(value: string): string {
  const sanitized = sanitizeHtml(normalizeRawText(value), SANITIZE_OPTIONS);
  return sanitized.trim();
}

export function sanitizeRequiredPlainText(
  value: string,
  options: { field: string; min: number; max: number }
): string {
  const sanitized = sanitizePlainText(value);

  if (sanitized.length < options.min) {
    throw new ApiError(400, `${options.field} must be at least ${options.min} characters`);
  }

  if (sanitized.length > options.max) {
    throw new ApiError(400, `${options.field} must be at most ${options.max} characters`);
  }

  return sanitized;
}

export function sanitizeOptionalPlainText(
  value: string | null | undefined,
  options: { field: string; max: number }
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const sanitized = sanitizePlainText(value);
  if (sanitized.length === 0) {
    return null;
  }

  if (sanitized.length > options.max) {
    throw new ApiError(400, `${options.field} must be at most ${options.max} characters`);
  }

  return sanitized;
}

export function clipAuditText(value: string | null | undefined, max = 160): string | null {
  if (!value) {
    return null;
  }

  const sanitized = sanitizePlainText(value);
  if (!sanitized) {
    return null;
  }

  return sanitized.length > max ? `${sanitized.slice(0, max - 1)}…` : sanitized;
}
