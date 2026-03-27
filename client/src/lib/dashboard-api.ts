import { apiRequest } from "./api-client";
import type { DashboardSummary } from "@/types/dashboard";

export function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>("/dashboard/summary", { auth: true });
}
