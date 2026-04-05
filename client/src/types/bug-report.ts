export type BugReportStatus = "open" | "triaged" | "closed";

export interface BugReportSummary {
  id: string;
  title: string;
  message: string;
  pagePath: string | null;
  userAgent: string | null;
  status: BugReportStatus;
  createdAt: string;
  updatedAt: string;
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
