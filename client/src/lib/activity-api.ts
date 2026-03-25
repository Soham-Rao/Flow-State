import { apiRequest } from "@/lib/api-client";
import type { ActivityLogEntry } from "@/types/activity";

export async function listActivityLogs(boardId?: string): Promise<ActivityLogEntry[]> {
  const query = boardId ? "?boardId=" + encodeURIComponent(boardId) : "";
  return apiRequest<ActivityLogEntry[]>("/activity" + query, {
    method: "GET",
    auth: true
  });
}
