export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  status: "active" | "archived";
  role: "admin" | "member" | "guest";
  joinedAt: string;
  lastAccessedAt: string | null;
}
