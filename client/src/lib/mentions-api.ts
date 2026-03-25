import { apiRequest } from "@/lib/api-client";
import type { CommentMentionDetail, MentionUnreadCounts } from "@/types/mentions";

export async function getUnreadMentions(): Promise<MentionUnreadCounts> {
  return apiRequest<MentionUnreadCounts>("/mentions/unread", {
    method: "GET",
    auth: true
  });
}

export async function markCommentMentionsSeen(commentIds: string[]): Promise<void> {
  await apiRequest<{ message: string }>("/mentions/comments/seen", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ commentIds })
  });
}

export async function markThreadMentionsSeen(conversationId: string): Promise<void> {
  await apiRequest<{ message: string }>("/mentions/threads/seen", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ conversationId })
  });
}

export async function markThreadReplyMentionsSeen(messageId: string): Promise<void> {
  await apiRequest<{ message: string }>("/mentions/threads/replies/seen", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ messageId })
  });
}

export async function listUnreadCommentMentions(): Promise<CommentMentionDetail[]> {
  return apiRequest<CommentMentionDetail[]>("/mentions/comments/unread", {
    method: "GET",
    auth: true
  });
}
