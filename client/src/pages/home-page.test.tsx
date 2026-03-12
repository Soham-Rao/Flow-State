import { render, screen } from "@testing-library/react";

import { HomePage } from "@/pages/home-page";

describe("HomePage", () => {
  it("renders dashboard heading", () => {
    render(<HomePage />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});
