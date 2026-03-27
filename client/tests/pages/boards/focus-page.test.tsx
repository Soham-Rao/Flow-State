import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import { FocusPage } from "@/pages/focus-page";
import { useAuthStore } from "@/stores/auth-store";

const seedUser = () => {
  useAuthStore.setState({
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "member",
      username: "tester",
      displayName: "Tester",
      bio: null,
      age: null,
      dateOfBirth: null,
      createdAt: new Date().toISOString()
    },
    status: "authenticated"
  });
};

describe("FocusPage", () => {
  beforeEach(() => {
    seedUser();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records partial focus time when skipped", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <FocusPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Focus minutes"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(42000);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /skip to break/i }));
    });

    const recentSection = screen.getByText("Recent sessions").parentElement as HTMLElement;
    expect(within(recentSection).getAllByText(/focus/i).length).toBe(1);
    expect(within(recentSection).getByText("42s")).toBeInTheDocument();
  });

  it("does not duplicate completed sessions", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter>
        <FocusPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Focus minutes"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    const recentSection = screen.getByText("Recent sessions").parentElement as HTMLElement;
    expect(within(recentSection).getAllByText(/focus/i).length).toBe(1);
  });
});
