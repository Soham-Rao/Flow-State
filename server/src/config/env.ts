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

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default(DEFAULT_CLIENT_ORIGIN),
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
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASS: z.string().trim().min(1).optional(),
  SMTP_FROM: z.string().trim().min(3).default("FlowState <no-reply@flo-state.in>"),
  SMTP_SECURE: z.coerce.boolean().default(false)
});

export const env = envSchema.parse(process.env);

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
