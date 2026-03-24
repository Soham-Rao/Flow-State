import { apiRequest } from "@/lib/api-client";
import { getSessionToken } from "@/lib/session";
import type {
  ChannelConversationSummary,
  ChannelMemberSummary,
  DmConversationSummary,
  ThreadAttachment,
  ThreadReplyAttachment,
  ThreadMessageSummary,
  ThreadReplySummary,
  ThreadReaction,
  ThreadReactionDetail,
  ThreadUserSummary,
  ThreadVoiceNote,
  ThreadReplyVoiceNote,
  ThreadDeleteResult,
  ThreadPermissionOverride
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

export async function listChannelConversations(): Promise<ChannelConversationSummary[]> {
  return apiRequest<ChannelConversationSummary[]>("/threads/channels", {
    method: "GET",
    auth: true
  });
}

export async function createChannel(input: {
  name: string;
  description?: string;
  members?: Array<{ userId: string; role?: "member" | "admin"; overrides?: ThreadPermissionOverride[] }>;
}): Promise<ChannelConversationSummary> {
  return apiRequest<ChannelConversationSummary>("/threads/channels", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function updateChannel(
  conversationId: string,
  input: { name?: string; description?: string | null }
): Promise<ChannelConversationSummary> {
  return apiRequest<ChannelConversationSummary>(`/threads/channels/${conversationId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function leaveChannel(conversationId: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/threads/channels/${conversationId}/leave`, {
    method: "POST",
    auth: true
  });
}

export async function deleteChannel(conversationId: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/threads/channels/${conversationId}`, {
    method: "DELETE",
    auth: true
  });
}

export async function listChannelMembers(conversationId: string): Promise<ChannelMemberSummary[]> {
  return apiRequest<ChannelMemberSummary[]>(`/threads/channels/${conversationId}/members`, {
    method: "GET",
    auth: true
  });
}

export async function addChannelMembers(
  conversationId: string,
  members: Array<{ userId: string; role?: "member" | "admin"; overrides?: ThreadPermissionOverride[] }>
): Promise<ChannelMemberSummary[]> {
  return apiRequest<ChannelMemberSummary[]>(`/threads/channels/${conversationId}/members`, {
    method: "POST",
    auth: true,
    body: JSON.stringify({ members })
  });
}

export async function updateChannelMemberOverrides(
  conversationId: string,
  memberId: string,
  overrides: ThreadPermissionOverride[]
): Promise<ChannelMemberSummary> {
  return apiRequest<ChannelMemberSummary>(`/threads/channels/${conversationId}/members/${memberId}/overrides`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify({ overrides })
  });
}

export async function removeChannelMember(conversationId: string, memberId: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/threads/channels/${conversationId}/members/${memberId}`, {
    method: "DELETE",
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

export async function createThreadMessage(
  conversationId: string,
  input: {
    body: string;
    mentions?: string[];
    forwarded?: boolean;
    hasAttachments?: boolean;
    hasVoiceNote?: boolean;
  }
): Promise<ThreadMessageSummary> {
  return apiRequest<ThreadMessageSummary>(`/threads/conversations/${conversationId}/messages`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}


export async function updateThreadMessage(messageId: string, input: { body: string }): Promise<ThreadMessageSummary> {
  return apiRequest<ThreadMessageSummary>(`/threads/messages/${messageId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function updateThreadReply(replyId: string, input: { body: string }): Promise<ThreadReplySummary> {
  return apiRequest<ThreadReplySummary>(`/threads/replies/${replyId}`, {
    method: "PATCH",
    auth: true,
    body: JSON.stringify(input)
  });
}

export async function deleteThreadMessage(messageId: string, scope: "me" | "all"): Promise<ThreadDeleteResult> {
  return apiRequest<ThreadDeleteResult>(`/threads/messages/${messageId}`, {
    method: "DELETE",
    auth: true,
    body: JSON.stringify({ scope })
  });
}
export async function listThreadReplies(messageId: string, params?: { limit?: number; cursor?: number }): Promise<ThreadReplySummary[]> {
  const search = new URLSearchParams();
  if (params?.limit) {
    search.set("limit", String(params.limit));
  }
  if (params?.cursor) {
    search.set("cursor", String(params.cursor));
  }
  const query = search.toString();
  const path = query ? `/threads/messages/${messageId}/replies?${query}` : `/threads/messages/${messageId}/replies`;
  return apiRequest<ThreadReplySummary[]>(path, {
    method: "GET",
    auth: true
  });
}

export async function deleteThreadReply(replyId: string, scope: "me" | "all" = "all"): Promise<ThreadDeleteResult> {
  return apiRequest<ThreadDeleteResult>(`/threads/replies/${replyId}`, {
    method: "DELETE",
    auth: true,
    body: JSON.stringify({ scope })
  });
}

export async function createThreadReply(messageId: string, input: { body: string; mentions?: string[]; hasAttachments?: boolean; hasVoiceNote?: boolean }): Promise<ThreadReplySummary> {
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

export async function fetchThreadAttachmentBlob(attachmentId: string): Promise<Blob> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/threads/attachments/${attachmentId}/download`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    throw new Error("Failed to download attachment");
  }

  return response.blob();
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

export async function listThreadMessageReactionDetails(messageId: string): Promise<ThreadReactionDetail[]> {
  return apiRequest<ThreadReactionDetail[]>(`/threads/messages/${messageId}/reactions/details`, {
    method: "GET",
    auth: true
  });
}

export async function listThreadReplyReactionDetails(replyId: string): Promise<ThreadReactionDetail[]> {
  return apiRequest<ThreadReactionDetail[]>(`/threads/replies/${replyId}/reactions/details`, {
    method: "GET",
    auth: true
  });
}

export async function toggleThreadReplyReaction(replyId: string, input: { emoji: string }): Promise<ThreadReaction[]> {
  return apiRequest<ThreadReaction[]>(`/threads/replies/${replyId}/reactions`, {
    method: "POST",
    auth: true,
    body: JSON.stringify(input)
  });
}





export async function createThreadVoiceNote(messageId: string, file: File, durationSec: number): Promise<ThreadVoiceNote> {
  const token = getSessionToken();
  const formData = new FormData();
  formData.append("voice", file);
  formData.append("durationSec", String(durationSec));

  const response = await fetch(`${API_BASE_URL}/threads/messages/${messageId}/voice-note`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: ThreadVoiceNote; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "Voice message upload failed");
  }

  return payload.data as ThreadVoiceNote;
}

export async function fetchThreadVoiceNote(voiceNoteId: string): Promise<Blob> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/threads/voice-notes/${voiceNoteId}/download`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    throw new Error("Failed to download voice message");
  }

  return response.blob();
}



export async function createThreadReplyAttachments(replyId: string, files: File[]): Promise<ThreadReplyAttachment[]> {
  const token = getSessionToken();
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(`${API_BASE_URL}/threads/replies/${replyId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: ThreadReplyAttachment[]; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "Attachment upload failed");
  }

  return payload.data ?? [];
}

export async function createThreadReplyVoiceNote(replyId: string, file: File, durationSec: number): Promise<ThreadReplyVoiceNote> {
  const token = getSessionToken();
  const formData = new FormData();
  formData.append("voice", file);
  formData.append("durationSec", String(durationSec));

  const response = await fetch(`${API_BASE_URL}/threads/replies/${replyId}/voice-note`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData
  });

  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: ThreadReplyVoiceNote; error?: { message?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message ?? "Voice message upload failed");
  }

  return payload.data as ThreadReplyVoiceNote;
}

export async function fetchThreadReplyAttachmentBlob(attachmentId: string): Promise<Blob> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/threads/reply-attachments/${attachmentId}/download`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    throw new Error("Failed to download attachment");
  }

  return response.blob();
}

export async function downloadThreadReplyAttachment(attachmentId: string, filename: string): Promise<void> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/threads/reply-attachments/${attachmentId}/download`, {
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

export async function fetchThreadReplyVoiceNote(voiceNoteId: string): Promise<Blob> {
  const token = getSessionToken();
  const response = await fetch(`${API_BASE_URL}/threads/reply-voice-notes/${voiceNoteId}/download`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });

  if (!response.ok) {
    throw new Error("Failed to download voice message");
  }

  return response.blob();
}


