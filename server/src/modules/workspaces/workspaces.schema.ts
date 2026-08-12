import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  joinCode: z.string().min(8).max(128),
  password: z.string().min(1).max(512)
});

export const joinWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  joinCode: z.string().min(1).max(128)
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;
