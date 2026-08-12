import { create } from "zustand";

import { clearApiCache } from "@/lib/api-client";
import { getWorkspaceCapabilities, listWorkspaces } from "@/lib/workspaces-api";
import { clearActiveWorkspaceId, getActiveWorkspaceId, setActiveWorkspaceId } from "@/lib/session";
import { useSocketStore } from "@/stores/socket-store";
import type { WorkspaceSummary } from "@/types/workspace";

interface WorkspaceState {
  workspaces: WorkspaceSummary[];
  active: WorkspaceSummary | null;
  canCreateWorkspace: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  clear: () => void;
}

async function loadMemberships(): Promise<{
  workspaces: WorkspaceSummary[];
  active: WorkspaceSummary | null;
  canCreateWorkspace: boolean;
}> {
  const [workspaces, capabilities] = await Promise.all([
    listWorkspaces(),
    getWorkspaceCapabilities()
  ]);
  const storedId = getActiveWorkspaceId();
  const active = storedId ? (workspaces.find((workspace) => workspace.id === storedId) ?? null) : null;
  if (active) setActiveWorkspaceId(active.id);
  else clearActiveWorkspaceId();
  return { workspaces, active, canCreateWorkspace: capabilities.canCreateWorkspace };
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  active: null,
  canCreateWorkspace: false,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    try {
      set({ ...(await loadMemberships()), loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  refresh: async () => {
    set({ ...(await loadMemberships()), loading: false });
  },

  switchWorkspace: (workspaceId) => {
    setActiveWorkspaceId(workspaceId);
    useSocketStore.getState().disconnect();
    clearApiCache();
    window.location.assign("/");
  },

  clear: () => {
    clearActiveWorkspaceId();
    set({ workspaces: [], active: null, canCreateWorkspace: false, loading: false });
  }
}));
