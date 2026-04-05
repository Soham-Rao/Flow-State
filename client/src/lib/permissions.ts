import type { AuthUser } from "@/types/auth";
import type { RolePermission } from "@/types/roles";

export function hasUserPermission(user: AuthUser | null | undefined, permission: RolePermission): boolean {
  return Boolean(user?.permissions?.includes(permission));
}
