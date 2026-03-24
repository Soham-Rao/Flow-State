import { z } from "zod";

export const createThreadMessageSchema = z.object({
  body: z.string().trim().max(5000),
  mentions: z.array(z.string().uuid()).optional(),
  forwarded: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  hasVoiceNote: z.boolean().optional()
}).refine((data) => data.body.length > 0 || data.hasAttachments || data.hasVoiceNote, {
  message: "Message body cannot be empty",
  path: ["body"]
});
export const createThreadReplySchema = z.object({
  body: z.string().trim().max(5000),
  mentions: z.array(z.string().uuid()).optional(),
  hasAttachments: z.boolean().optional(),
  hasVoiceNote: z.boolean().optional()
}).refine((data) => data.body.length > 0 || data.hasAttachments || data.hasVoiceNote, {
  message: "Reply body cannot be empty",
  path: ["body"]
});

export const updateThreadMessageSchema = z.object({
  body: z.string().trim().max(5000)
});

export const updateThreadReplySchema = z.object({
  body: z.string().trim().max(5000)
});

export const deleteThreadMessageSchema = z.object({
  scope: z.enum(["me", "all"])
});

export const deleteThreadReplySchema = z.object({
  scope: z.enum(["me", "all"])
});

export const threadReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(40)
});

export const threadMessageListSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.coerce.number().int().positive().optional()
});

const channelMemberOverrideSchema = z.object({
  permission: z.enum([
    "channel_read",
    "channel_write",
    "channel_edit",
    "channel_members_add",
    "channel_members_remove",
    "channel_manage_overrides",
    "channel_delete"
  ]),
  access: z.enum(["allow", "deny"])
});

const channelMemberInputSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["member", "admin"]).optional(),
  overrides: z.array(channelMemberOverrideSchema).optional()
});

export const createChannelSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  members: z.array(channelMemberInputSchema).optional()
});

export const addChannelMembersSchema = z.object({
  members: z.array(channelMemberInputSchema).min(1)
});

export const updateChannelMemberOverridesSchema = z.object({
  overrides: z.array(channelMemberOverrideSchema)
});

export const updateChannelSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional()
}).refine((data) => data.name !== undefined || data.description !== undefined, {
  message: "At least one field must be provided"
});

export type CreateThreadMessageInput = z.infer<typeof createThreadMessageSchema>;
export type CreateThreadReplyInput = z.infer<typeof createThreadReplySchema>;
export type UpdateThreadMessageInput = z.infer<typeof updateThreadMessageSchema>;
export type UpdateThreadReplyInput = z.infer<typeof updateThreadReplySchema>;
export type DeleteThreadMessageInput = z.infer<typeof deleteThreadMessageSchema>;
export type DeleteThreadReplyInput = z.infer<typeof deleteThreadReplySchema>;
export type ThreadReactionInput = z.infer<typeof threadReactionSchema>;
export type ThreadMessageListParams = z.infer<typeof threadMessageListSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type AddChannelMembersInput = z.infer<typeof addChannelMembersSchema>;
export type UpdateChannelMemberOverridesInput = z.infer<typeof updateChannelMemberOverridesSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;



