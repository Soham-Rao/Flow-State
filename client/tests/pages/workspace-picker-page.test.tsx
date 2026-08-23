import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { WorkspacePickerPage } from "@/pages/workspace-picker-page";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

describe("WorkspacePickerPage account expiry", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      active: null,
      canCreateWorkspace: true,
      loading: false
    });
    useAuthStore.setState({
      hydrated: true,
      status: "authenticated",
      error: null,
      user: {
        id: "user-1",
        name: "New User",
        email: "new@example.com",
        role: null,
        permissions: [],
        username: null,
        displayName: null,
        bio: null,
        age: null,
        dateOfBirth: null,
        createdAt: "2026-08-17T12:00:00.000Z",
        workspaceAssignment: {
          hasEverBeenAssigned: false,
          expiresAt: "2026-08-19T12:00:00.000Z",
          protectedReason: null,
          retentionHours: 48
        }
      }
    });
  });

  it("shows the server-provided expiry deadline for a never-assigned account", () => {
    render(<MemoryRouter><WorkspacePickerPage /></MemoryRouter>);

    expect(screen.getByText(/Join or create a workspace by 19 Aug 2026, 12:00 UTC to keep this account/i)).toBeInTheDocument();
    expect(screen.getByText(/automatically removed after 48 hours/i)).toBeInTheDocument();
  });

  it("does not show an expiry warning once membership history exists", () => {
    useAuthStore.setState((state) => ({
      user: state.user ? {
        ...state.user,
        workspaceAssignment: {
          hasEverBeenAssigned: true,
          expiresAt: null,
          protectedReason: null,
          retentionHours: 48
        }
      } : null
    }));

    render(<MemoryRouter><WorkspacePickerPage /></MemoryRouter>);
    expect(screen.queryByText(/to keep this account/i)).not.toBeInTheDocument();
  });
});
