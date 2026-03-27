import { z } from "zod";

export const markCommentMentionsSchema = z.object({
  commentIds: z.array(z.string().uuid()).min(1)
});

export const markThreadMentionsSchema = z.object({
  conversationId: z.string().uuid()
});

export const markThreadMessageMentionsSchema = z.object({
  messageIds: z.array(z.string().uuid()).min(1)
});

export const markThreadReplyMentionsSchema = z.object({
  messageId: z.string().uuid()
});

export const markThreadReplyMentionIdsSchema = z.object({
  replyIds: z.array(z.string().uuid()).min(1)
});

export type MarkCommentMentionsInput = z.infer<typeof markCommentMentionsSchema>;
export type MarkThreadMentionsInput = z.infer<typeof markThreadMentionsSchema>;
export type MarkThreadMessageMentionsInput = z.infer<typeof markThreadMessageMentionsSchema>;
export type MarkThreadReplyMentionsInput = z.infer<typeof markThreadReplyMentionsSchema>;
export type MarkThreadReplyMentionIdsInput = z.infer<typeof markThreadReplyMentionIdsSchema>;
