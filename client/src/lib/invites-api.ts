import { apiRequest } from "@/lib/api-client";
import type { InviteLookup, InviteSummary } from "@/types/invite";

export async function createInvite(input: { email?: string }): Promise<InviteSummary> {
  return apiRequest<InviteSummary>("/invites", {
    method: "POST",
    body: JSON.stringify(input),
    auth: true
  });
}

export async function listInvites(): Promise<InviteSummary[]> {
  return apiRequest<InviteSummary[]>("/invites", {
    method: "GET",
    auth: true
  });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await apiRequest<{ message: string }>(`/invites/${inviteId}`, {
    method: "DELETE",
    auth: true
  });
}

export async function lookupInvite(token: string): Promise<InviteLookup> {
  return apiRequest<InviteLookup>(`/invites/lookup/${token}`, {
    method: "GET"
  });
}

export async function updateInviteRoles(inviteId: string, roleIds: string[]): Promise<InviteSummary> {
  return apiRequest<InviteSummary>(`/invites/${inviteId}/roles`, {
    method: "PATCH",
    body: JSON.stringify({ roleIds }),
    auth: true
  });
}
