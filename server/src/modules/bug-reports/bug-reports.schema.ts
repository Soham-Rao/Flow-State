import { z } from "zod";

import { bugReportStatuses } from "../../db/schema.js";

export const createBugReportSchema = z.object({
  title: z.string().trim().min(4).max(200),
  message: z.string().trim().min(10).max(4000),
  pagePath: z.string().trim().max(512).optional()
});

export const listBugReportsQuerySchema = z.object({
  status: z.enum(bugReportStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export const updateBugReportStatusSchema = z.object({
  status: z.enum(bugReportStatuses)
});

export type CreateBugReportInput = z.infer<typeof createBugReportSchema>;
export type ListBugReportsQuery = z.infer<typeof listBugReportsQuerySchema>;
export type UpdateBugReportStatusInput = z.infer<typeof updateBugReportStatusSchema>;
