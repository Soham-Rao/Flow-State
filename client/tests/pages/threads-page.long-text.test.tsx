import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreadExpandableText } from "@/pages/threads-page.long-text";

describe("ThreadExpandableText", () => {
  it("reveals long text one chunk at a time", () => {
    const text = [
      "A".repeat(60),
      "B".repeat(60),
      "C".repeat(60)
    ].join("\n\n");

    render(<ThreadExpandableText text={text} chunkSize={70} className="test-text" />);

    expect(screen.getByText("Read more")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.queryByText("Read less")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Read more"));
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Read less")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Read more"));
    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(screen.queryByText("Read more")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Read less"));
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });
});
