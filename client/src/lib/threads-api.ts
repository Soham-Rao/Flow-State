import { apiRequest } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session";
import type {
  DmConversationSummary,
  ThreadAttachment,
  ThreadMessageSummary,
  ThreadReplySummary,
  ThreadReaction,
  ThreadUserSummary
 } from "@/types/threads";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function listDmUsers(): Promise<ThreadUserSummary[]> {
  return apiRequest<ThreadUserSummary[]>("/threads/dms/users", {
    method: "GET",
    auth: true
  });
}

export async function listDmConversations(): Promise<DmConversationSummary[]> {
  return apiRequest<DmConversationSummary[]>("/threads/dms", {
    method: "GET",
    auth: true
  });
}

export async function getOrCreateDmConversation(userId: string): Promise<DmConversationSummary> {
  return apiRequest<DmConversationSummary>(`/threads/dms/${userId}`, {
    method: "POST",
    auth: true
  });
}

export async function listThreadMessages(conversationId: string, params?: { limit?: number; cursor?: number }): Promise<ThreadMessageSummary[]> {
  const search = new URLSearchParams();
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.cursor) {
    search.set("cursor", String(params.cursor));
  }
  const query = search.toString();
  const path = query ? `/threads/conversations/${conversationId}/messages?${query}` : `/threads/conversations/${conversationId}/messages`;
  return apiRequest<ThreadMessageSummary[]>(path, {
    method: "GET",
    auth: true
  });
}

export async function createThreadMessage(conversationId: string, input: { body: string; mentions?: string[]; forwarded?: boolean; hasAttachments?: boolean }): Promise<ThreadMessageSummary> {
  return apiRequest<ThreadMessageSummary>(`/threads/conversations/${conversationId}/messages`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function listThreadReplies(messageId: string): Promise<ThreadReplySummary[]> {
  return apiRequest<ThreadReplySummary[]>(`/threads/messages/${messageId}/replies`, {
    method: "GET",
    auth: true
  });
}

export async function createThreadReply(messageId: string, input: { body: string; mentions?: string[] }): Promise<ThreadReplySummary> {
  return apiRequest<ThreadReplySummary>(`/threads/messages/${messageId}/replies`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function createThreadMessageAttachments(messageId: string, files: File[]): Promise<ThreadAttachment[]> {
  const token = getSessionToken();
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE_URL}/threads/messages/${messageId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: ThreadAttachment[]; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "Attachment upload failed");
  }

  return payload.data ?? [];
}

export async function downloadThreadAttachment(attachmentId: string, filename: string): Promise<void> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/threads/attachments/${attachmentId}/download`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    throw new Error("Failed to download attachment");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
export async function toggleThreadMessageReaction(messageId: string, input: { emoji: string }): Promise<ThreadReaction[]> {
  return apiRequest<ThreadReaction[]>(`/threads/messages/${messageId}/reactions`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function toggleThreadReplyReaction(replyId: string, input: { emoji: string }): Promise<ThreadReaction[]> {
  return apiRequest<ThreadReaction[]>(`/threads/replies/${replyId}/reactions`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}




