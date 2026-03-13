import { z } from "zod";

import { cardCoverColors, cardPriorities, labelColors, retentionModes } from "../../db/schema.js";
import { boardBackgrounds } from "./boards.constants.js";

const boardBackgroundSchema = z.enum(boardBackgrounds);
const cardPrioritySchema = z.enum(cardPriorities);
const retentionModeSchema = z.enum(retentionModes);
const labelColorSchema = z.enum(labelColors);
const cardCoverColorSchema = z.enum(cardCoverColors);

const retentionMinutesSchema = z.number().int().min(1).max(525600);
const archiveRetentionMinutesSchema = z.number().int().min(1).max(525600);

export const createBoardSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  background: boardBackgroundSchema.default("teal-gradient"),
  retentionMode: retentionModeSchema.default("card_and_attachments"),
  retentionMinutes: retentionMinutesSchema.default(7 * 24 * 60),
  archiveRetentionMinutes: archiveRetentionMinutesSchema.default(7 * 24 * 60)
});

export const updateBoardSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    background: boardBackgroundSchema.optional(),
    retentionMode: retentionModeSchema.optional(),
    retentionMinutes: retentionMinutesSchema.optional(),
    archiveRetentionMinutes: archiveRetentionMinutesSchema.optional()
  })
  .refine((value) =>
    value.name !== undefined ||
    value.description !== undefined ||
    value.background !== undefined ||
    value.retentionMode !== undefined ||
    value.retentionMinutes !== undefined ||
    value.archiveRetentionMinutes !== undefined, {
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
  coverColor: cardCoverColorSchema.optional(),
  dueDate: z.coerce.date().optional()
});

export const updateCardSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(5000).optional(),
    priority: cardPrioritySchema.optional(),
    coverColor: z.union([cardCoverColorSchema, z.null()]).optional(),
    dueDate: z.union([z.coerce.date(), z.null()]).optional()
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.priority !== undefined ||
      value.coverColor !== undefined ||
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



export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: labelColorSchema
});

export const updateLabelSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: labelColorSchema.optional()
  })
  .refine((value) => value.name !== undefined || value.color !== undefined, {
    message: "At least one field is required"
  });

export const assignLabelSchema = z.object({
  labelId: z.string().uuid()
});

export const assignAssigneeSchema = z.object({
  userId: z.string().uuid()
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  mentions: z.array(z.string().uuid()).optional()
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

export const commentReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(40)
});

export const restoreArchiveSchema = z.object({
  renameConflicts: z.boolean().optional()
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
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
export type AssignLabelInput = z.infer<typeof assignLabelSchema>;
export type AssignAssigneeInput = z.infer<typeof assignAssigneeSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
export type CommentReactionInput = z.infer<typeof commentReactionSchema>;
export type RestoreArchiveInput = z.infer<typeof restoreArchiveSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;
export type MoveCardInput = z.infer<typeof moveCardSchema>;
