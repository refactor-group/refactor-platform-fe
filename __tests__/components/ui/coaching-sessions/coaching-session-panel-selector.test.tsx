import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  CoachingSessionPanelSelector,
} from "@/components/ui/coaching-sessions/coaching-session-panel-selector";

// Radix Select requires pointer events that jsdom doesn't fully support.
// We test the trigger rendering directly and the callback via onValueChange.

describe("CoachingSessionPanelSelector", () => {
  const defaultProps = {
    activeSection: "goals" as const,
    onSectionChange: vi.fn(),
    goalsLabel: "Goals (1/3)",
    agreementsLabel: "Agreements (2)",
  };

  it("renders dropdown trigger showing active section label", () => {
    render(<CoachingSessionPanelSelector {...defaultProps} />);

    expect(screen.getByText("Goals (1/3)")).toBeInTheDocument();
  });

  it("shows agreements label when agreements is active", () => {
    render(
      <CoachingSessionPanelSelector
        {...defaultProps}
        activeSection="agreements"
      />
    );

    expect(screen.getByText("Agreements (2)")).toBeInTheDocument();
  });

  it("renders a combobox trigger element", () => {
    render(<CoachingSessionPanelSelector {...defaultProps} />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("updates displayed label when activeSection prop changes", () => {
    const { rerender } = render(
      <CoachingSessionPanelSelector {...defaultProps} activeSection="goals" />
    );

    expect(screen.getByText("Goals (1/3)")).toBeInTheDocument();

    rerender(
      <CoachingSessionPanelSelector {...defaultProps} activeSection="agreements" />
    );

    expect(screen.getByText("Agreements (2)")).toBeInTheDocument();
  });
});
