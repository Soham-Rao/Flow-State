import crypto from "node:crypto";

import { and, count, desc, eq } from "drizzle-orm";

import { db } from "../../db/connection.js";
import { bugReports, users, workspaceMemberships, type BugReportStatus } from "../../db/schema.js";
import { sanitizeOptionalPlainText, sanitizeRequiredPlainText } from "../../utils/sanitize.js";
import { assertWorkspaceManager } from "../../utils/access-control.js";
import { ApiError } from "../../utils/api-error.js";
import { getCurrentWorkspaceId } from "../../utils/workspace-context.js";
import { recordAuditLog } from "../security/audit.service.js";
import type { SecurityRequestContext } from "../../utils/request-context.js";
import type { CreateBugReportInput, ListBugReportsQuery } from "./bug-reports.schema.js";

export interface BugReportSummary {
  id: string;
  title: string;
  message: string;
  pagePath: string | null;
  userAgent: string | null;
  status: BugReportStatus;
  createdAt: Date;
  updatedAt: Date;
  reporter: {
    id: string;
    name: string;
    email: string;
    username: string | null;
    displayName: string | null;
    role: "admin" | "member" | "guest";
  };
}

export interface BugReportAdminListResponse {
  items: BugReportSummary[];
  openCount: number;
}

export interface BugReportSummaryResponse {
  myOpenCount: number;
  canManageAll: boolean;
  openCount: number | null;
}

function toSummary(row: {
  id: string;
  title: string;
  message: string;
  pagePath: string | null;
  userAgent: string | null;
  status: BugReportStatus;
  createdAt: Date;
  updatedAt: Date;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reporterUsername: string | null;
  reporterDisplayName: string | null;
  reporterRole: "admin" | "member" | "guest";
}): BugReportSummary {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    pagePath: row.pagePath,
    userAgent: row.userAgent,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reporter: {
      id: row.reporterId,
      name: row.reporterName,
      email: row.reporterEmail,
      username: row.reporterUsername,
      displayName: row.reporterDisplayName,
      role: row.reporterRole
    }
  };
}

async function hasWorkspaceManagerPermission(userId: string): Promise<boolean> {
  try {
    await assertWorkspaceManager(userId);
    return true;
  } catch {
    return false;
  }
}

async function getOpenCount(whereClause?: ReturnType<typeof eq> | ReturnType<typeof and>): Promise<number> {
  const rows = await db
    .select({ total: count(bugReports.id) })
    .from(bugReports)
    .where(and(
      eq(bugReports.workspaceId, getCurrentWorkspaceId()),
      whereClause ?? eq(bugReports.status, "open")
    ));

  return rows[0]?.total ?? 0;
}

export async function createBugReport(
  reporterId: string,
  input: CreateBugReportInput,
  context: Pick<SecurityRequestContext, "ip" | "userAgent" | "requestId"> 
): Promise<BugReportSummary> {
  const now = new Date();
  const id = crypto.randomUUID();
  const title = sanitizeRequiredPlainText(input.title, { field: "Bug title", min: 4, max: 200 });
  const message = sanitizeRequiredPlainText(input.message, { field: "Bug report", min: 10, max: 4000 });
  const pagePath = sanitizeOptionalPlainText(input.pagePath, { field: "Page path", max: 512 }) ?? null;
  const userAgent = context.userAgent?.slice(0, 512) ?? null;

  await db.insert(bugReports)
    .values({
      id,
      workspaceId: getCurrentWorkspaceId(),
      reporterId,
      title,
      message,
      pagePath,
      userAgent,
      status: "open",
      createdAt: now,
      updatedAt: now
    })
    .execute();

  await recordAuditLog({
    actorId: reporterId,
    action: "bug_report.create",
    targetType: "bug_report",
    targetId: id,
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: { pagePath }
  });

  const created = await getBugReportByIdForViewer(reporterId, id);
  if (!created) {
    throw new ApiError(500, "Failed to create bug report");
  }
  return created;
}

export async function listMyBugReports(userId: string): Promise<BugReportSummary[]> {
  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      message: bugReports.message,
      pagePath: bugReports.pagePath,
      userAgent: bugReports.userAgent,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterId: users.id,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterUsername: users.username,
      reporterDisplayName: users.displayName,
      reporterRole: workspaceMemberships.role
    })
    .from(bugReports)
    .innerJoin(users, eq(bugReports.reporterId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.reporterId, userId)))
    .orderBy(desc(bugReports.createdAt))
    .limit(50);

  return rows.map(toSummary);
}

export async function listAdminBugReports(userId: string, query: ListBugReportsQuery): Promise<BugReportAdminListResponse> {
  await assertWorkspaceManager(userId);

  const filters = query.status
    ? and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.status, query.status))
    : eq(bugReports.workspaceId, getCurrentWorkspaceId());
  const limit = Math.min(query.limit ?? 50, 100);
  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      message: bugReports.message,
      pagePath: bugReports.pagePath,
      userAgent: bugReports.userAgent,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterId: users.id,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterUsername: users.username,
      reporterDisplayName: users.displayName,
      reporterRole: workspaceMemberships.role
    })
    .from(bugReports)
    .innerJoin(users, eq(bugReports.reporterId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(filters)
    .orderBy(desc(bugReports.createdAt))
    .limit(limit);

  const openRows = await db
    .select({ total: count(bugReports.id) })
    .from(bugReports)
    .where(and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.status, "open")));

  return {
    items: rows.map(toSummary),
    openCount: openRows[0]?.total ?? 0
  };
}

export async function updateBugReportStatus(
  userId: string,
  reportId: string,
  status: BugReportStatus,
  context: Pick<SecurityRequestContext, "ip" | "userAgent" | "requestId">
): Promise<BugReportSummary> {
  await assertWorkspaceManager(userId);

  const existing = await getBugReportByIdForAdmin(reportId);
  if (!existing) {
    throw new ApiError(404, "Bug report not found");
  }

  await db.update(bugReports)
    .set({
      status,
      updatedAt: new Date()
    })
    .where(and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.id, reportId)))
    .execute();

  await recordAuditLog({
    actorId: userId,
    action: "bug_report.status_updated",
    targetType: "bug_report",
    targetId: reportId,
    ip: context.ip,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: {
      previousStatus: existing.status,
      nextStatus: status
    }
  });

  const updated = await getBugReportByIdForAdmin(reportId);
  if (!updated) {
    throw new ApiError(404, "Bug report not found");
  }

  return updated;
}

export async function getBugReportSummary(userId: string): Promise<BugReportSummaryResponse> {
  const myOpenRows = await db
    .select({ total: count(bugReports.id) })
    .from(bugReports)
    .where(and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.reporterId, userId), eq(bugReports.status, "open")));

  const canManageAll = await hasWorkspaceManagerPermission(userId);
  const openCount = canManageAll ? await getOpenCount() : null;

  return {
    myOpenCount: myOpenRows[0]?.total ?? 0,
    canManageAll,
    openCount
  };
}

async function getBugReportByIdForViewer(viewerId: string, reportId: string): Promise<BugReportSummary | null> {
  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      message: bugReports.message,
      pagePath: bugReports.pagePath,
      userAgent: bugReports.userAgent,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterId: users.id,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterUsername: users.username,
      reporterDisplayName: users.displayName,
      reporterRole: workspaceMemberships.role
    })
    .from(bugReports)
    .innerJoin(users, eq(bugReports.reporterId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.id, reportId), eq(bugReports.reporterId, viewerId)))
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

async function getBugReportByIdForAdmin(reportId: string): Promise<BugReportSummary | null> {
  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      message: bugReports.message,
      pagePath: bugReports.pagePath,
      userAgent: bugReports.userAgent,
      status: bugReports.status,
      createdAt: bugReports.createdAt,
      updatedAt: bugReports.updatedAt,
      reporterId: users.id,
      reporterName: users.name,
      reporterEmail: users.email,
      reporterUsername: users.username,
      reporterDisplayName: users.displayName,
      reporterRole: workspaceMemberships.role
    })
    .from(bugReports)
    .innerJoin(users, eq(bugReports.reporterId, users.id))
    .innerJoin(workspaceMemberships, and(eq(workspaceMemberships.userId, users.id), eq(workspaceMemberships.workspaceId, getCurrentWorkspaceId())))
    .where(and(eq(bugReports.workspaceId, getCurrentWorkspaceId()), eq(bugReports.id, reportId)))
    .limit(1);

  return rows[0] ? toSummary(rows[0]) : null;
}

