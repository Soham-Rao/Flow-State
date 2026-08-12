import { apiRequest } from "@/lib/api-client";
import type { WorkspaceSummary } from "@/types/workspace";

export function listWorkspaces(): Promise<WorkspaceSummary[]> {
  return apiRequest<WorkspaceSummary[]>("/workspaces", { auth: true, skipCache: true });
}

export function getWorkspaceCapabilities(): Promise<{ canCreateWorkspace: boolean }> {
  return apiRequest<{ canCreateWorkspace: boolean }>("/workspaces/capabilities", {
    auth: true,
    skipCache: true
  });
}

export function createWorkspace(input: { name: string; joinCode: string; password: string }): Promise<WorkspaceSummary> {
  return apiRequest<WorkspaceSummary>("/workspaces", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input),
    skipCache: true
  });
}

export function joinWorkspace(input: { name: string; joinCode: string }): Promise<WorkspaceSummary> {
  return apiRequest<WorkspaceSummary>("/workspaces/join", {
    method: "POST",
    auth: true,
    body: JSON.stringify(input),
    skipCache: true
  });
}
