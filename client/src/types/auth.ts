import type { RolePermission } from "@/types/roles";

export type UserRole = "admin" | "member" | "guest";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  permissions: RolePermission[];
  assignedRoles?: Array<{ id: string; name: string; color: string }>;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  age: number | null;
  dateOfBirth: string | null;
  createdAt: string;
  workspaceAssignment?: {
    hasEverBeenAssigned: boolean;
    expiresAt: string | null;
    protectedReason: "configured" | "pending_invite" | null;
    retentionHours: number;
  };
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}


