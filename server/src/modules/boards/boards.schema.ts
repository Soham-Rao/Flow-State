import { z } from "zod";

import { boardBackgrounds } from "./boards.constants.js";

const boardBackgroundSchema = z.enum(boardBackgrounds);

export const createBoardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  background: boardBackgroundSchema.default("teal-gradient")
});

export const updateBoardSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    background: boardBackgroundSchema.optional()
  })
  .refine((value) => value.name !== undefined || value.description !== undefined || value.background !== undefined, {
    message: "At least one field is required"
  });

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isDoneList: z.boolean().default(false)
});

export const updateListSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    isDoneList: z.boolean().optional()
  })
  .refine((value) => value.name !== undefined || value.isDoneList !== undefined, {
    message: "At least one field is required"
  });

export const reorderListsSchema = z.object({
  listIds: z.array(z.string().uuid()).min(1)
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ReorderListsInput = z.infer<typeof reorderListsSchema>;
