import { apiRequest } from "@/lib/api-client";
import type { BugReportAdminListResponse, BugReportStatus, BugReportSummary, BugReportSummaryResponse } from "@/types/bug-report";

export function createBugReport(input: {
  title: string;
  message: string;
  pagePath?: string;
}): Promise<BugReportSummary> {
  return apiRequest<BugReportSummary>("/bug-reports", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input),
    invalidateTags: ["bug-reports:mine", "bug-reports:summary", "bug-reports:admin"]
  });
}

export function listMyBugReports(): Promise<BugReportSummary[]> {
  return apiRequest<BugReportSummary[]>("/bug-reports/mine", {
    method: "GET",
    auth: true,
    cacheTtlMs: 5_000,
    cacheTags: ["bug-reports:mine"]
  });
}

export function getBugReportSummary(): Promise<BugReportSummaryResponse> {
  return apiRequest<BugReportSummaryResponse>("/bug-reports/summary", {
    method: "GET",
    auth: true,
    cacheTtlMs: 5_000,
    cacheTags: ["bug-reports:summary"]
  });
}

export function listAdminBugReports(status?: BugReportStatus | "all"): Promise<BugReportAdminListResponse> {
  const params = new URLSearchParams();
  if (status && status !== "all") {
    params.set("status", status);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<BugReportAdminListResponse>(`/bug-reports${suffix}`, {
    method: "GET",
    auth: true,
    cacheTtlMs: 5_000,
    cacheTags: ["bug-reports:admin"]
  });
}

export function updateBugReportStatus(reportId: string, status: BugReportStatus): Promise<BugReportSummary> {
  return apiRequest<BugReportSummary>(`/bug-reports/${reportId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ status }),
    invalidateTags: ["bug-reports:mine", "bug-reports:summary", "bug-reports:admin"]
  });
}
