import { z } from "zod";

import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16).default("dev-only-secret-change-this"),
  JWT_EXPIRES_IN: z.string().min(2).default("7d"),
  DATABASE_URL: z.string().default("./data/flowstate.db")
});

export const env = envSchema.parse(process.env);
