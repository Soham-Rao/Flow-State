import { z } from "zod";

export const registerBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
