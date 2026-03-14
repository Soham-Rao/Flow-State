import { z } from "zod";

import { rolePermissions } from "../../db/schema.js";

export const rolePermissionSchema = z.enum(rolePermissions);

const roleNameSchema = z.string().trim().min(2).max(50);
const roleColorSchema = z.string().regex(/^#([0-9a-fA-F]{6})$/);

export const createRoleSchema = z.object({
  name: roleNameSchema,
  color: roleColorSchema,
  priority: z.number().int().min(1).max(100).optional(),
  mentionable: z.boolean().optional(),
  permissions: z.array(rolePermissionSchema).min(1)
});

export const updateRoleSchema = z.object({
  name: roleNameSchema.optional(),
  color: roleColorSchema.optional(),
  priority: z.number().int().min(1).max(100).optional(),
  mentionable: z.boolean().optional(),
  permissions: z.array(rolePermissionSchema).min(1).optional()
});

export const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1)
});

export const updateInviteRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1)
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
export type UpdateInviteRolesInput = z.infer<typeof updateInviteRolesSchema>;
