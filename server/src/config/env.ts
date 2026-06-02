import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

import dotenv from "dotenv";

dotenv.config();

const DEFAULT_JWT_SECRET = "dev-only-secret-change-this";
const DEFAULT_MYSQL_URL = "mysql://root:root@localhost:3306/flowstate_dev";
const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";
const DEFAULT_DM_KEY = "e9974d0faff86d131135ba429165c29227fc81753b56c3d2a9cccffff353235a";
const DEFAULT_UPLOADS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../uploads"
);
const DEFAULT_BACKUP_LOCAL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../backups"
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default(DEFAULT_CLIENT_ORIGIN),
  ALLOWED_ORIGINS: z.string().trim().optional(),
  JWT_SECRET: z.string().min(16).default(DEFAULT_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().min(2).default("7d"),
  MYSQL_URL: z.string().url().default(DEFAULT_MYSQL_URL),
  FLOWSTATE_DM_ENCRYPTION_KEY: z.string().refine(
    (val) =>
      (val.length === 64 && /^[0-9a-fA-F]+$/.test(val)) ||
      (val.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(val)),
    { message: "Must be a 32-byte key as 64 hex or 44 base64" }
  ).default(DEFAULT_DM_KEY),
  PUBLIC_APP_URL: z.string().url().default(DEFAULT_CLIENT_ORIGIN),
  FLOWSTATE_UPLOADS_DIR: z.string().min(1).default(DEFAULT_UPLOADS_DIR),
  PASSWORD_RESET_ENABLED: z.coerce.boolean().default(false),
  PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(60),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PUBLIC_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  HEALTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  HEALTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASS: z.string().trim().min(1).optional(),
  SMTP_FROM: z.string().trim().min(3).default("FlowState <no-reply@flo-state.in>"),
  SMTP_SECURE: z.coerce.boolean().default(false),
  REMINDER_EMAILS_ENABLED: z.coerce.boolean().default(false),
  REMINDER_EMAIL_TIMEZONE: z.string().trim().min(1).default("Asia/Kolkata"),
  REMINDER_EMAIL_MORNING_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  REMINDER_EMAIL_AFTERNOON_HOUR: z.coerce.number().int().min(0).max(23).default(16),
  REMINDER_EMAIL_DAILY_CAP: z.coerce.number().int().min(0).max(10000).default(240),
  OPS_ALERT_EMAIL_TO: z.string().trim().optional(),
  OPS_ALERT_EMAIL_FROM: z.string().trim().optional(),
  BACKUP_LOCAL_DIR: z.string().trim().min(1).default(DEFAULT_BACKUP_LOCAL_DIR),
  BACKUP_ENCRYPTION_ENABLED: z.coerce.boolean().default(false),
  BACKUP_ENCRYPTION_KEY: z.string().trim().optional(),
  BACKUP_ENCRYPTION_KEY_ID: z.string().trim().optional(),
  BACKUP_VERIFY_SCRATCH_MYSQL_URL: z.string().url().optional(),
  BACKUP_R2_BUCKET: z.string().trim().optional(),
  BACKUP_R2_PREFIX: z.string().trim().default("flowstate"),
  BACKUP_R2_ACCOUNT_ID: z.string().trim().optional(),
  BACKUP_R2_ACCESS_KEY_ID: z.string().trim().optional(),
  BACKUP_R2_SECRET_ACCESS_KEY: z.string().trim().optional(),
  BACKUP_R2_ENDPOINT: z.string().trim().optional(),
  BACKUP_RETENTION_LOCAL_PREDEPLOY: z.coerce.number().int().min(1).default(5),
  BACKUP_RETENTION_LOCAL_DAILY: z.coerce.number().int().min(1).default(7),
  BACKUP_RETENTION_LOCAL_WEEKLY: z.coerce.number().int().min(1).default(4),
  BACKUP_RETENTION_REMOTE_PREDEPLOY: z.coerce.number().int().min(1).default(10),
  BACKUP_RETENTION_REMOTE_DAILY: z.coerce.number().int().min(1).default(14),
  BACKUP_RETENTION_REMOTE_WEEKLY: z.coerce.number().int().min(1).default(8),
  DB_SLOW_QUERY_THRESHOLD_MS: z.coerce.number().int().min(0).default(750),
  MYSQL_CONTAINER_NAME: z.string().trim().default("flowstate-mysql"),
  MYSQL_ENV_FILE: z.string().trim().default("/opt/flowstate/infra/mysql.env")
});

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, "");
}

function toSocketOrigin(origin: string): string {
  if (origin.startsWith("https://")) {
    return `wss://${origin.slice("https://".length)}`;
  }

  if (origin.startsWith("http://")) {
    return `ws://${origin.slice("http://".length)}`;
  }

  return origin;
}

export const env = envSchema.parse(process.env);

const extraAllowedOrigins = (env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

const localOrigins = env.NODE_ENV === "production"
  ? []
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      "http://localhost:4000",
      "http://127.0.0.1:4000"
    ];

export const allowedOrigins = Array.from(new Set([
  normalizeOrigin(env.CLIENT_ORIGIN),
  normalizeOrigin(env.PUBLIC_APP_URL),
  ...extraAllowedOrigins,
  ...localOrigins
]));

export const socketAllowedOrigins = allowedOrigins;
export const cspConnectSources = Array.from(new Set([
  "'self'",
  ...allowedOrigins,
  ...allowedOrigins.map(toSocketOrigin)
]));

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) {
    return true;
  }

  return allowedOrigins.includes(normalizeOrigin(origin));
}

if (env.NODE_ENV === "production") {
  const missing: string[] = [];

  if (env.JWT_SECRET === DEFAULT_JWT_SECRET) missing.push("JWT_SECRET");
  if (env.MYSQL_URL === DEFAULT_MYSQL_URL) missing.push("MYSQL_URL");
  if (env.CLIENT_ORIGIN === DEFAULT_CLIENT_ORIGIN) missing.push("CLIENT_ORIGIN");
  if (env.FLOWSTATE_DM_ENCRYPTION_KEY === DEFAULT_DM_KEY) missing.push("FLOWSTATE_DM_ENCRYPTION_KEY");
  if (env.PUBLIC_APP_URL === DEFAULT_CLIENT_ORIGIN) missing.push("PUBLIC_APP_URL");

  if (missing.length > 0) {
    throw new Error(`Missing production env overrides: ${missing.join(", ")}`);
  }
}

if (env.BACKUP_ENCRYPTION_ENABLED) {
  const rawKey = env.BACKUP_ENCRYPTION_KEY?.trim() ?? "";
  const isHex = rawKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawKey);
  const isBase64 = rawKey.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(rawKey);
  if (!isHex && !isBase64) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex or 44 base64 characters");
  }
}
