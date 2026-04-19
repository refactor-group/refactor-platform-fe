import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { TranscriptToggleButton } from "@/components/ui/coaching-sessions/transcript-toggle-button";
import { IndicatorStatus } from "@/lib/transcript/indicator-status";

describe("TranscriptToggleButton — basic behavior", () => {
  it('renders "Show transcript" when closed', () => {
    render(<TranscriptToggleButton isOpen={false} onToggle={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Show transcript" })
    ).toBeInTheDocument();
  });

  it('renders "Hide transcript" when open', () => {
    render(<TranscriptToggleButton isOpen={true} onToggle={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Hide transcript" })
    ).toBeInTheDocument();
  });

  it("calls onToggle when clicked", () => {
    const onToggle = vi.fn();
    render(<TranscriptToggleButton isOpen={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("reports pressed state via aria-pressed", () => {
    const { rerender } = render(
      <TranscriptToggleButton isOpen={false} onToggle={vi.fn()} />
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    rerender(<TranscriptToggleButton isOpen={true} onToggle={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("TranscriptToggleButton — status indicator", () => {
  it("renders no indicator element when status is None (default)", () => {
    const { container } = render(
      <TranscriptToggleButton isOpen={false} onToggle={vi.fn()} />
    );
    // The indicator component returns null for None — neither a dot span
    // with color classes nor an svg glyph should be present.
    expect(container.querySelector(".bg-red-500")).toBeNull();
    expect(container.querySelector(".bg-emerald-500")).toBeNull();
  });

  it("renders the red pulsing dot for Recording", () => {
    const { container } = render(
      <TranscriptToggleButton
        isOpen={false}
        onToggle={vi.fn()}
        indicatorStatus={IndicatorStatus.Recording}
      />
    );
    const dot = container.querySelector(".bg-red-500");
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain("motion-safe:animate-pulse");
  });

  it("renders the green solid dot for TranscriptReady", () => {
    const { container } = render(
      <TranscriptToggleButton
        isOpen={false}
        onToggle={vi.fn()}
        indicatorStatus={IndicatorStatus.TranscriptReady}
      />
    );
    expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  });
});
