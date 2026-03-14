import type { UserRole } from "@/types/auth";

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface InviteSummary {
  id: string;
  email: string | null;
  role: UserRole;
  roleIds: string[];
  createdBy: string;
  acceptedBy: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  status: InviteStatus;
  inviteUrl: string;
}

export interface InviteLookup {
  email: string | null;
  expiresAt: string;
  status: InviteStatus;
}
