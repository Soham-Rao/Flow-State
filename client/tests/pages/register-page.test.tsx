import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { PrivacyPage } from "@/pages/legal/privacy-page";
import { TermsPage } from "@/pages/legal/terms-page";
import { RegisterPage } from "@/pages/register-page";
import { useAuthStore } from "@/stores/auth-store";

function renderRegisterPage(): void {
  render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/privacy" element={<div>Privacy route</div>} />
        <Route path="/terms" element={<div>Terms route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("RegisterPage legal consent", () => {
  beforeEach(() => {
    useAuthStore.setState({
      hydrated: true,
      status: "idle",
      user: null,
      error: null
    });
  });

  it("shows legal links on the registration form", () => {
    renderRegisterPage();

    expect(screen.getAllByRole("link", { name: /Privacy Policy/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("link", { name: /Terms of Use/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("requires legal consent before attempting registration", async () => {
    renderRegisterPage();

    fireEvent.change(screen.getByPlaceholderText(/Full name/i), { target: { value: "Test User" } });
    fireEvent.change(screen.getByPlaceholderText(/Work email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByPlaceholderText(/^Password$/i), { target: { value: "password123" } });

    const form = screen.getByRole("button", { name: /Create account/i }).closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(await screen.findByText(/You must accept the Privacy Policy and Terms of Use/i)).toBeInTheDocument();
  });
});

describe("Public legal pages", () => {
  it("renders the privacy policy with storage and logging language", () => {
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Privacy Policy/i })).toBeInTheDocument();
    expect(screen.getByText(/browser storage and local session data/i)).toBeInTheDocument();
    expect(screen.getByText(/operational and security logs/i)).toBeInTheDocument();
  });

  it("renders the terms page with authorization language", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Terms of Use/i })).toBeInTheDocument();
    expect(screen.getByText(/You must not access resources, workspaces, or data beyond the permissions granted to your account/i)).toBeInTheDocument();
  });
});
