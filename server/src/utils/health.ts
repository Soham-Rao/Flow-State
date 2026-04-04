import { pool } from "../db/connection.js";

export interface HealthPayload {
  service: string;
  status: "ok" | "degraded";
  timestamp: string;
  ready?: boolean;
  checks?: {
    database: "ok" | "error";
  };
}

export function buildLiveHealthPayload(): HealthPayload {
  return {
    service: "flowstate-server",
    status: "ok",
    timestamp: new Date().toISOString(),
    ready: true
  };
}

export async function buildReadyHealthPayload(): Promise<HealthPayload> {
  try {
    await pool.query("SELECT 1");
    return {
      service: "flowstate-server",
      status: "ok",
      timestamp: new Date().toISOString(),
      ready: true,
      checks: {
        database: "ok"
      }
    };
  } catch {
    return {
      service: "flowstate-server",
      status: "degraded",
      timestamp: new Date().toISOString(),
      ready: false,
      checks: {
        database: "error"
      }
    };
  }
}
