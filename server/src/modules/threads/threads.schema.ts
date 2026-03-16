import { z } from "zod";

export const createThreadMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  mentions: z.array(z.string().uuid()).optional(),
  forwarded: z.boolean().optional()
});

export const createThreadReplySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  mentions: z.array(z.string().uuid()).optional()
});

export const threadReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(40)
});

export const threadMessageListSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional()
});

export type CreateThreadMessageInput = z.infer<typeof createThreadMessageSchema>;
export type CreateThreadReplyInput = z.infer<typeof createThreadReplySchema>;
export type ThreadReactionInput = z.infer<typeof threadReactionSchema>;
export type ThreadMessageListParams = z.infer<typeof threadMessageListSchema>;

