import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppErrorBoundary } from "@/components/layout/app-error-boundary";

function Boom(): JSX.Element {
  throw new Error("boom");
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a safe fallback when a child crashes", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>
    );

    expect(screen.getByText(/FlowState hit an unexpected problem/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reload FlowState/i })).toBeInTheDocument();
  });
});
