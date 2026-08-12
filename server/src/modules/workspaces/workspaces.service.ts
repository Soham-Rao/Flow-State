import crypto from "node:crypto";

import bcrypt from "bcryptjs";
import { and, asc, eq, or } from "drizzle-orm";

import { env } from "../../config/env.js";
import { db } from "../../db/connection.js";
import { userRoleAssignments, workspaceMemberships, workspaces } from "../../db/schema.js";
import { seedDefaultRolesForWorkspace } from "../../db/init-roles.js";
import { ApiError } from "../../utils/api-error.js";
import { sanitizeRequiredPlainText } from "../../utils/sanitize.js";
import { recordAuditLog } from "../security/audit.service.js";
import { getSystemRoleIds } from "../roles/roles.service.js";
import { DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME, DEFAULT_WORKSPACE_SLUG } from "./workspaces.constants.js";
import type { CreateWorkspaceInput, JoinWorkspaceInput } from "./workspaces.schema.js";

export { DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME, DEFAULT_WORKSPACE_SLUG };

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "archived";
  role: "admin" | "member" | "guest";
  joinedAt: Date;
  lastAccessedAt: Date | null;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return base || "workspace";
}

async function availableSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const rows = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, candidate)).limit(1);
    if (!rows[0]) return candidate;
    candidate = `${base}-${crypto.randomBytes(3).toString("hex")}`;
  }
  throw new ApiError(409, "Could not allocate a unique workspace URL");
}

export async function listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      status: workspaces.status,
      role: workspaceMemberships.role,
      joinedAt: workspaceMemberships.joinedAt,
      lastAccessedAt: workspaceMemberships.lastAccessedAt
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(and(
      eq(workspaceMemberships.userId, userId),
      eq(workspaceMemberships.status, "active"),
      eq(workspaces.status, "active")
    ))
    .orderBy(asc(workspaces.name));
}

export async function resolveWorkspaceForUser(userId: string, requestedIdOrSlug: string | null): Promise<WorkspaceSummary> {
  const memberships = await listUserWorkspaces(userId);
  const workspace = requestedIdOrSlug
    ? memberships.find((entry) => entry.id === requestedIdOrSlug || entry.slug === requestedIdOrSlug)
    : (env.NODE_ENV === "test" && process.env.TEST_EXPLICIT_WORKSPACES !== "true" ? memberships[0] : null);

  if (!workspace) {
    throw new ApiError(403, "You do not have access to this workspace");
  }

  await db.update(workspaceMemberships)
    .set({ lastAccessedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(workspaceMemberships.workspaceId, workspace.id), eq(workspaceMemberships.userId, userId)))
    .execute();

  return workspace;
}

export function isWorkspaceCreationEnabled(): boolean {
  return Boolean(env.WORKSPACE_CREATION_PASSWORD_HASH?.trim());
}

export async function createWorkspace(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceSummary> {
  const passwordHash = env.WORKSPACE_CREATION_PASSWORD_HASH?.trim();
  if (!passwordHash || !await bcrypt.compare(input.password, passwordHash)) {
    throw new ApiError(403, "Workspace creation is not available");
  }

  const name = sanitizeRequiredPlainText(input.name, { field: "Workspace name", min: 2, max: 100 });
  const existingName = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.name, name)).limit(1);
  if (existingName[0]) throw new ApiError(409, "A workspace with this name already exists");
  const joinCodeHash = await bcrypt.hash(input.joinCode, 12);
  const slug = await availableSlug(name);
  const workspaceId = crypto.randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(workspaces).values({
      id: workspaceId,
      name,
      slug,
      status: "active",
      joinCodeHash,
      createdBy: userId,
      createdAt: now,
      updatedAt: now
    }).execute();
    await tx.insert(workspaceMemberships).values({
      workspaceId,
      userId,
      status: "active",
      role: "admin",
      joinedAt: now,
      lastAccessedAt: now,
      createdAt: now,
      updatedAt: now
    }).execute();
    await seedDefaultRolesForWorkspace(tx, workspaceId, { assignAdminUserId: userId });
  });

  await recordAuditLog({
    workspaceId,
    actorId: userId,
    action: "workspace.create.success",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { name, slug }
  });

  return {
    id: workspaceId,
    name,
    slug,
    status: "active",
    role: "admin",
    joinedAt: now,
    lastAccessedAt: now
  };
}

export async function joinWorkspace(userId: string, input: JoinWorkspaceInput): Promise<WorkspaceSummary> {
  const name = sanitizeRequiredPlainText(input.name, { field: "Workspace name", min: 2, max: 120 });
  const workspaceRows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      status: workspaces.status,
      joinCodeHash: workspaces.joinCodeHash
    })
    .from(workspaces)
    .where(and(
      eq(workspaces.status, "active"),
      or(eq(workspaces.name, name), eq(workspaces.slug, slugify(name)))
    ))
    .limit(1);
  const workspace = workspaceRows[0];

  if (!workspace?.joinCodeHash || !await bcrypt.compare(input.joinCode, workspace.joinCodeHash)) {
    throw new ApiError(403, "Workspace name or join code is invalid");
  }

  const existingRows = await db
    .select({ status: workspaceMemberships.status })
    .from(workspaceMemberships)
    .where(and(
      eq(workspaceMemberships.workspaceId, workspace.id),
      eq(workspaceMemberships.userId, userId)
    ))
    .limit(1);
  if (existingRows[0]?.status === "active") {
    throw new ApiError(409, "You are already a member of this workspace");
  }

  const { memberRoleId } = await getSystemRoleIds(workspace.id);
  const now = new Date();
  await db.transaction(async (tx) => {
    if (existingRows[0]) {
      await tx.update(workspaceMemberships)
        .set({ status: "active", role: "member", joinedAt: now, lastAccessedAt: now, updatedAt: now })
        .where(and(
          eq(workspaceMemberships.workspaceId, workspace.id),
          eq(workspaceMemberships.userId, userId)
        ))
        .execute();
    } else {
      await tx.insert(workspaceMemberships).values({
        workspaceId: workspace.id,
        userId,
        status: "active",
        role: "member",
        joinedAt: now,
        lastAccessedAt: now,
        createdAt: now,
        updatedAt: now
      }).execute();
    }
    await tx.delete(userRoleAssignments).where(and(
      eq(userRoleAssignments.workspaceId, workspace.id),
      eq(userRoleAssignments.userId, userId)
    )).execute();
    await tx.insert(userRoleAssignments).values({
      workspaceId: workspace.id,
      userId,
      roleId: memberRoleId,
      createdAt: now
    }).execute();
  });

  await recordAuditLog({
    workspaceId: workspace.id,
    actorId: userId,
    action: "workspace.join.success",
    targetType: "workspace",
    targetId: workspace.id
  });

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    status: workspace.status,
    role: "member",
    joinedAt: now,
    lastAccessedAt: now
  };
}
