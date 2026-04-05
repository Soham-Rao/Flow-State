import { apiRequest } from "./api-client";
import type { AnnouncementAudience, AnnouncementAudienceOptions, AnnouncementDetail } from "@/types/announcements";

export function getAnnouncementCapabilities(): Promise<{ canSend: boolean }> {
  return apiRequest<{ canSend: boolean }>("/announcements/capabilities", {
    auth: true,
    cacheTtlMs: 5_000,
    cacheTags: ["announcements:capabilities"]
  });
}

export function listAnnouncementAudienceOptions(options?: { skipCache?: boolean }): Promise<AnnouncementAudienceOptions> {
  return apiRequest<AnnouncementAudienceOptions>("/announcements/audience", {
    auth: true,
    cacheTtlMs: 5_000,
    cacheTags: ["announcements:audience"],
    skipCache: options?.skipCache
  });
}

export function createAnnouncement(input: { subject: string; body: string; audience: AnnouncementAudience }): Promise<AnnouncementDetail> {
  return apiRequest<AnnouncementDetail>("/announcements", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input),
    invalidateTags: ["dashboard:summary", "announcements:list"]
  });
}

export function markAnnouncementsSeen(ids: string[]): Promise<{ ids: string[] }> {
  return apiRequest<{ ids: string[] }>("/announcements/seen", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ ids }),
    invalidateTags: ["dashboard:summary", "announcements:list"]
  });
}

export function deleteAnnouncements(ids: string[]): Promise<{ ids: string[] }> {
  return apiRequest<{ ids: string[] }>("/announcements/delete", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ ids }),
    invalidateTags: ["dashboard:summary", "announcements:list"]
  });
}
