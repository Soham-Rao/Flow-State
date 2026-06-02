import { apiRequest } from "@/lib/api-client";
import type { CalendarFeedSummary, CalendarFeedType, CalendarFeedsResponse } from "@/types/calendar";

export async function getCalendarFeeds(): Promise<CalendarFeedsResponse> {
  return apiRequest<CalendarFeedsResponse>("/calendar/feeds", {
    auth: true,
    cacheTtlMs: 30_000,
    cacheTags: ["calendar-feeds"]
  });
}

export async function regenerateCalendarFeed(type: CalendarFeedType): Promise<CalendarFeedSummary> {
  return apiRequest<CalendarFeedSummary>(`/calendar/feeds/${type}/regenerate`, {
    method: "POST",
    auth: true,
    invalidateTags: ["calendar-feeds"]
  });
}
