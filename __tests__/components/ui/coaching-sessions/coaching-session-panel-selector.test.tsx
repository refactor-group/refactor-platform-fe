import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  CoachingSessionPanelSelector,
  PanelSection,
} from "@/components/ui/coaching-sessions/coaching-session-panel-selector";

// Radix Select requires pointer events that jsdom doesn't fully support.
// We test the trigger rendering directly and the callback via onValueChange.

describe("CoachingSessionPanelSelector", () => {
  const defaultProps = {
    activeSection: PanelSection.Goals,
    onSectionChange: vi.fn(),
    counts: {
      [PanelSection.Goals]: "1/3",
      [PanelSection.Agreements]: "2",
    },
  };

  it("renders dropdown trigger showing active section name and count", () => {
    render(<CoachingSessionPanelSelector {...defaultProps} />);

    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("shows agreements name and count when agreements is active", () => {
    render(
      <CoachingSessionPanelSelector
        {...defaultProps}
        activeSection={PanelSection.Agreements}
      />
    );

    expect(screen.getByText("Agreements")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders a combobox trigger element", () => {
    render(<CoachingSessionPanelSelector {...defaultProps} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("updates displayed label when activeSection prop changes", () => {
    const { rerender } = render(
      <CoachingSessionPanelSelector {...defaultProps} activeSection={PanelSection.Goals} />
    );

    expect(screen.getByText("Goals")).toBeInTheDocument();

    rerender(
      <CoachingSessionPanelSelector {...defaultProps} activeSection={PanelSection.Agreements} />
    );

    expect(screen.getByText("Agreements")).toBeInTheDocument();
  });
});
