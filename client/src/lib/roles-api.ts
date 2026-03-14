import { apiRequest } from "@/lib/api-client";
import type { RolePermission, RoleSummary, UserRoleAssignment } from "@/types/roles";

export async function listRoles(): Promise<RoleSummary[]> {
  return apiRequest<RoleSummary[]>("/roles", {
    method: "GET",
    auth: true
  });
}

export async function createRole(input: {
  name: string;
  color: string;
  priority?: number;
  mentionable?: boolean;
  permissions: RolePermission[];
}): Promise<RoleSummary> {
  return apiRequest<RoleSummary>("/roles", {
    method: "POST",
    body: JSON.stringify(input),
    auth: true
  });
}

export async function updateRole(roleId: string, input: {
  name?: string;
  color?: string;
  priority?: number;
  mentionable?: boolean;
  permissions?: RolePermission[];
}): Promise<RoleSummary> {
  return apiRequest<RoleSummary>(`/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
    auth: true
  });
}

export async function deleteRole(roleId: string): Promise<void> {
  await apiRequest<{ message: string }>(`/roles/${roleId}`, {
    method: "DELETE",
    auth: true
  });
}

export async function listRoleAssignments(): Promise<UserRoleAssignment[]> {
  return apiRequest<UserRoleAssignment[]>("/roles/assignments", {
    method: "GET",
    auth: true
  });
}

export async function updateUserRoles(userId: string, roleIds: string[]): Promise<UserRoleAssignment> {
  return apiRequest<UserRoleAssignment>(`/roles/assignments/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ roleIds }),
    auth: true
  });
}

