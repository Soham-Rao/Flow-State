import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { HomePage } from "@/pages/home-page";
import { useAuthStore } from "@/stores/auth-store";

const getDashboardSummary = vi.fn();
const createAnnouncement = vi.fn();
const getAnnouncementCapabilities = vi.fn();
const listAnnouncementAudienceOptions = vi.fn();
const markAnnouncementsSeen = vi.fn();
const listInvites = vi.fn();
const createInvite = vi.fn();
const revokeInvite = vi.fn();
const listActivityLogs = vi.fn();

vi.mock("@/lib/dashboard-api", () => ({
  getDashboardSummary: (...args: unknown[]) => getDashboardSummary(...args)
}));

vi.mock("@/lib/announcements-api", () => ({
  createAnnouncement: (...args: unknown[]) => createAnnouncement(...args),
  getAnnouncementCapabilities: (...args: unknown[]) => getAnnouncementCapabilities(...args),
  listAnnouncementAudienceOptions: (...args: unknown[]) => listAnnouncementAudienceOptions(...args),
  markAnnouncementsSeen: (...args: unknown[]) => markAnnouncementsSeen(...args)
}));

vi.mock("@/lib/invites-api", () => ({
  listInvites: (...args: unknown[]) => listInvites(...args),
  createInvite: (...args: unknown[]) => createInvite(...args),
  revokeInvite: (...args: unknown[]) => revokeInvite(...args)
}));

vi.mock("@/lib/activity-api", () => ({
  listActivityLogs: (...args: unknown[]) => listActivityLogs(...args)
}));

describe("HomePage", () => {
  const baseSummary = {
    assignedCards: [],
    createdCards: [],
    dueReminders: [],
    boardMentions: [],
    threadMentions: [],
    announcements: [],
    activityHighlights: [],
    newJoiners: [],
    metrics: {
      weekly: {
        cardsCompleted: 0,
        cardsArchived: 0,
        cardsDeleted: 0,
        newCards: 0,
        newLists: 0,
        newBoards: 0
      },
      monthly: {
        cardsCompleted: 0,
        cardsArchived: 0,
        cardsDeleted: 0,
        newCards: 0,
        newLists: 0,
        newBoards: 0
      }
    }
  };

  beforeEach(() => {
    useAuthStore.setState({
      hydrated: true,
      status: "unauthenticated",
      user: null,
      error: null
    });
    getDashboardSummary.mockResolvedValue(baseSummary);
    getAnnouncementCapabilities.mockResolvedValue({ canSend: false });
    listAnnouncementAudienceOptions.mockResolvedValue({ roles: [], users: [] });
    listInvites.mockResolvedValue([]);
    listActivityLogs.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders dashboard heading", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows announcements and marks them seen on open", async () => {
    useAuthStore.setState({
      hydrated: true,
      status: "authenticated",
      user: {
        id: "user-1",
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin",
        permissions: [],
        username: "ada",
        displayName: "Ada",
        bio: null,
        age: null,
        dateOfBirth: null,
        createdAt: new Date().toISOString()
      },
      error: null
    });

    getDashboardSummary.mockResolvedValue({
      ...baseSummary,
      announcements: [
        {
          id: "announcement-1",
          subject: "System update",
          body: "We shipped the new dashboard.",
          createdAt: Date.now(),
          author: {
            id: "user-1",
            name: "Ada Lovelace",
            displayName: "Ada",
            email: "ada@example.com"
          }
        }
      ]
    });
    getAnnouncementCapabilities.mockResolvedValue({ canSend: true });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("System update")).toBeInTheDocument();

    fireEvent.click(screen.getByText("System update"));

    expect(await screen.findByText(/From Ada/)).toBeInTheDocument();
    await waitFor(() => {
      expect(markAnnouncementsSeen).toHaveBeenCalledWith(["announcement-1"]);
    });
  });

  it("shows role alongside usernames in the audience list", async () => {
    useAuthStore.setState({
      hydrated: true,
      status: "authenticated",
      user: {
        id: "user-2",
        name: "Grace Hopper",
        email: "grace@example.com",
        role: "admin",
        permissions: [],
        username: "grace",
        displayName: "Grace",
        bio: null,
        age: null,
        dateOfBirth: null,
        createdAt: new Date().toISOString()
      },
      error: null
    });

    getDashboardSummary.mockResolvedValue(baseSummary);
    getAnnouncementCapabilities.mockResolvedValue({ canSend: true });
    listAnnouncementAudienceOptions.mockResolvedValue({
      roles: [
        { id: "role-1", name: "Admin", color: "#ef4444" }
      ],
      users: [
        {
          id: "user-1",
          name: "Ada Lovelace",
          displayName: "Ada",
          username: "ada",
          email: "ada@example.com",
          role: "admin"
        }
      ]
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "New announcement" }));

    const audienceEntries = await screen.findAllByText("@ada • admin");
    expect(audienceEntries.length).toBeGreaterThan(0);
  });
});
