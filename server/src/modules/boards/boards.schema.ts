import { z } from "zod";

import { cardPriorities } from "../../db/schema.js";
import { boardBackgrounds } from "./boards.constants.js";

const boardBackgroundSchema = z.enum(boardBackgrounds);
const cardPrioritySchema = z.enum(cardPriorities);

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

export const createCardSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  priority: cardPrioritySchema.default("medium"),
  dueDate: z.coerce.date().optional()
});

export const updateCardSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: cardPrioritySchema.optional(),
    dueDate: z.union([z.coerce.date(), z.null()]).optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.priority !== undefined ||
      value.dueDate !== undefined,
    {
      message: "At least one field is required"
    }
  );

export const moveCardSchema = z.object({
  cardId: z.string().uuid(),
  sourceListId: z.string().uuid(),
  destinationListId: z.string().uuid(),
  destinationIndex: z.number().int().min(0)
});


export const createChecklistSchema = z.object({
  title: z.string().trim().min(1).max(120)
});

export const updateChecklistSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional()
  })
  .refine((value) => value.title !== undefined, {
    message: "At least one field is required"
  });

export const createChecklistItemSchema = z.object({
  title: z.string().trim().min(1).max(200)
});

export const updateChecklistItemSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    isDone: z.boolean().optional()
  })
  .refine((value) => value.title !== undefined || value.isDone !== undefined, {
    message: "At least one field is required"
  });

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type CreateListInput = z.infer<typeof createListSchema>;
export type UpdateListInput = z.infer<typeof updateListSchema>;
export type ReorderListsInput = z.infer<typeof reorderListsSchema>;

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
