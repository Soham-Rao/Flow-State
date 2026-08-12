import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { LoginPage } from "@/pages/login-page";
import { useAuthStore } from "@/stores/auth-store";

describe("LoginPage password visibility", () => {
  beforeEach(() => {
    useAuthStore.setState({
      hydrated: true,
      status: "idle",
      user: null,
      error: null
    });
  });

  it("can reveal and hide the password", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const password = screen.getByPlaceholderText(/^Password$/i);
    expect(password).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /Show password/i }));
    expect(password).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: /Hide password/i }));
    expect(password).toHaveAttribute("type", "password");
  });
});
