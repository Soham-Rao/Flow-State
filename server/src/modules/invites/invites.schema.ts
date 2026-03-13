import { z } from "zod";

export const createInviteSchema = z.object({
  email: z.string().trim().email().max(255).optional()
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
