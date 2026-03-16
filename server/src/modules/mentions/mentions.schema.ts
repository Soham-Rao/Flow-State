import { z } from "zod";

export const markCommentMentionsSchema = z.object({
  commentIds: z.array(z.string().uuid()).min(1)
});

export const markThreadMentionsSchema = z.object({
  conversationId: z.string().uuid()
});

export type MarkCommentMentionsInput = z.infer<typeof markCommentMentionsSchema>;
export type MarkThreadMentionsInput = z.infer<typeof markThreadMentionsSchema>;
