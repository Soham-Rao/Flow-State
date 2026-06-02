import { apiRequest } from "@/lib/api-client";
import type { NotificationPreferences } from "@/types/notifications";

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return apiRequest<NotificationPreferences>("/notifications/preferences", {
    auth: true,
    cacheTtlMs: 30_000,
    cacheTags: ["notification-preferences"]
  });
}

export async function updateNotificationPreferences(
  input: NotificationPreferences
): Promise<NotificationPreferences> {
  return apiRequest<NotificationPreferences>("/notifications/preferences", {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input),
    invalidateTags: ["notification-preferences"]
  });
}
