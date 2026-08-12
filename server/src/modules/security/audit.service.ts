import crypto from "node:crypto";

import { lt } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import { auditLogs } from "../../db/schema.js";
import { getOptionalWorkspaceId } from "../../utils/workspace-context.js";

const MAX_METADATA_LENGTH = 4000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000;

let lastPruneAt = 0;

export interface AuditLogInput {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) {
    return null;
  }

  return value.length > max ? value.slice(0, max) : value;
}

function serializeMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  const raw = JSON.stringify(metadata);
  return raw.length > MAX_METADATA_LENGTH ? raw.slice(0, MAX_METADATA_LENGTH) : raw;
}

export function hashAuditValue(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function pruneExpiredAuditLogs(): Promise<void> {
  const cutoff = new Date(Date.now() - env.AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await db.delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff))
    .execute();
}

export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  const now = new Date();

  await db.insert(auditLogs)
    .values({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId === undefined ? getOptionalWorkspaceId() : input.workspaceId,
      actorId: input.actorId ?? null,
      action: truncate(input.action, 255) ?? "unknown",
      targetType: truncate(input.targetType ?? null, 64),
      targetId: truncate(input.targetId ?? null, 255),
      ip: truncate(input.ip ?? null, 128),
      userAgent: truncate(input.userAgent ?? null, 512),
      requestId: truncate(input.requestId ?? null, 255),
      metadata: serializeMetadata(input.metadata),
      createdAt: now
    })
    .execute();

  if (now.getTime() - lastPruneAt < PRUNE_INTERVAL_MS) {
    return;
  }

  lastPruneAt = now.getTime();
  void pruneExpiredAuditLogs().catch((error) => {
    console.error("Failed to prune audit logs", error);
  });
}
