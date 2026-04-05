import { apiRequest } from "@/lib/api-client";
import type { ActivityLogEntry } from "@/types/activity";

export async function listActivityLogs(boardId?: string): Promise<ActivityLogEntry[]> {
  const query = boardId ? "?boardId=" + encodeURIComponent(boardId) : "";
  const tag = boardId ? `activity:board:${boardId}` : "activity:workspace";
  return apiRequest<ActivityLogEntry[]>("/activity" + query, {
    method: "GET",
    auth: true,
    cacheTtlMs: boardId ? 1_200 : 2_500,
    cacheTags: [tag]
  });
}
