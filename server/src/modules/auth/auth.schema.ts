import { z } from "zod";

export const registerBodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  inviteToken: z.string().trim().min(8).optional()
});

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128)
});

const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[\p{L}\p{N}._'-]+$/u, "Username can only include letters, numbers, dots, underscores, apostrophes, and dashes");

const nullableString = (min: number, max: number) => z
  .union([z.string().trim().min(min).max(max), z.null()])
  .optional();

const nullableOptionalString = (max: number) => z
  .union([z.string().trim().max(max), z.null()])
  .optional();

const nullableNumber = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : value),
  z.coerce.number().int().min(0).max(130).nullable()
).optional();

const nullableDate = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : value),
  z.coerce.date().nullable()
).optional();

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    username: z.union([usernameSchema, z.null()]).optional(),
    displayName: nullableString(2, 100),
    bio: nullableOptionalString(500),
    age: nullableNumber,
    dateOfBirth: nullableDate
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "No updates provided"
  });

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
