import type { Request, Response } from "express";

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|authorization|cookie|api[_-]?key|access[_-]?key|private[_-]?key/i;
const MAX_STRING_LENGTH = 2000;

type LogLevel = "info" | "warn" | "error";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

function truncateString(value: string): string {
  return value.length <= MAX_STRING_LENGTH ? value : `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function serializeError(error: unknown): JsonObject {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncateString(error.message),
      stack: truncateString(error.stack ?? "") || null
    };
  }

  return {
    message: truncateString(String(error))
  };
}

export function redactForLogs(value: unknown, keyPath = ""): JsonValue {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry, index) => redactForLogs(entry, `${keyPath}[${index}]`));
  }

  if (typeof value === "object") {
    const output: JsonObject = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(keyPath)) {
        output[key] = "[REDACTED]";
        continue;
      }
      output[key] = redactForLogs(nestedValue, key);
    }
    return output;
  }

  return truncateString(String(value));
}

function writeLog(level: LogLevel, event: string, payload?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(payload ? (redactForLogs(payload) as JsonObject) : {})
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(event: string, payload?: Record<string, unknown>): void {
    writeLog("info", event, payload);
  },
  warn(event: string, payload?: Record<string, unknown>): void {
    writeLog("warn", event, payload);
  },
  error(event: string, payload?: Record<string, unknown>): void {
    writeLog("error", event, payload);
  }
};

export function logHttpRequest(req: Request, res: Response, durationMs: number): void {
  logger.info("http.request", {
    requestId: req.requestId ?? null,
    method: req.method,
    path: req.originalUrl,
    statusCode: res.statusCode,
    durationMs,
    contentLength: res.getHeader("content-length") ?? null,
    ip: req.ip,
    userAgent: req.headers["user-agent"] ?? null,
    actorId: req.auth?.userId ?? null,
    referer: req.headers.referer ?? null
  });
}
