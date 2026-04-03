import { z } from "zod";

const audienceSchema = z.object({
  sendToAll: z.boolean().default(false),
  includeRoleIds: z.array(z.string().min(1)).default([]),
  excludeRoleIds: z.array(z.string().min(1)).default([]),
  includeUserIds: z.array(z.string().min(1)).default([]),
  excludeUserIds: z.array(z.string().min(1)).default([])
});

export const createAnnouncementSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(5000),
  audience: audienceSchema
});

export const markAnnouncementsSeenSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

export const deleteAnnouncementsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1)
});

export type AnnouncementAudienceInput = z.infer<typeof audienceSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type MarkAnnouncementsSeenInput = z.infer<typeof markAnnouncementsSeenSchema>;
export type DeleteAnnouncementsInput = z.infer<typeof deleteAnnouncementsSchema>;
