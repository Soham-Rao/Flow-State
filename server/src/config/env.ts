import { z } from "zod";

import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16).default("dev-only-secret-change-this"),
  JWT_EXPIRES_IN: z.string().min(2).default("7d"),
  DATABASE_URL: z.string().default("./data/flowstate.db"),
  FLOWSTATE_DM_ENCRYPTION_KEY: z.string().refine(
    (val) =>
      (val.length === 64 && /^[0-9a-fA-F]+$/.test(val)) ||
      (val.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(val)),
    { message: "Must be a 32-byte key as 64 hex or 44 base64" }
  ).default("e9974d0faff86d131135ba429165c29227fc81753b56c3d2a9cccffff353235a")
});

export const env = envSchema.parse(process.env);