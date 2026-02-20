import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  CoachViewMode,
  StatusVisibility,
  TimeRange,
  BoardSort,
} from "@/types/assigned-actions";
import { ActionsPageHeader } from "@/components/ui/actions/actions-page-header";
import { TestProviders } from "@/test-utils/providers";

function Wrapper({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>;
}

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const defaultProps = {
  isCoach: false,
  viewMode: CoachViewMode.MyActions,
  onViewModeChange: vi.fn(),
  statusVisibility: StatusVisibility.Open,
  onStatusVisibilityChange: vi.fn(),
  timeRange: TimeRange.AllTime,
  onTimeRangeChange: vi.fn(),
  sortField: BoardSort.Default,
  onSortFieldChange: vi.fn(),
  relationshipId: undefined,
  onRelationshipChange: vi.fn(),
  relationships: [
    { id: "rel-1", label: "Alice Smith → Bob Jones" },
    { id: "rel-2", label: "Alice Smith → Charlie Brown" },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActionsPageHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page title", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText("Actions")).toBeInTheDocument();
  });

  it("shows coach view toggle when isCoach is true", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} isCoach={true} />
      </Wrapper>
    );

    expect(screen.getByText("My Actions")).toBeInTheDocument();
    expect(screen.getByText("Coachee Actions")).toBeInTheDocument();
  });

  it("hides coach view toggle when isCoach is false", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} isCoach={false} />
      </Wrapper>
    );

    expect(screen.queryByText("My Actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Coachee Actions")).not.toBeInTheDocument();
  });

  it("renders status visibility controls", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders sort select with Default selected", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    expect(screen.getByText("Default")).toBeInTheDocument();
  });

  it("calls onStatusVisibilityChange when toggling", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    await user.click(screen.getByText("All"));
    expect(defaultProps.onStatusVisibilityChange).toHaveBeenCalledWith(
      StatusVisibility.All
    );
  });

  it("calls onViewModeChange when toggling coach view", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} isCoach={true} />
      </Wrapper>
    );

    await user.click(screen.getByText("Coachee Actions"));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith(
      CoachViewMode.CoacheeActions
    );
  });

  it("calls onSortFieldChange when selecting a sort option", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    // Open the sort select via its aria-label, then pick "Due date"
    fireEvent.click(screen.getByRole("combobox", { name: /sort order/i }));
    fireEvent.click(screen.getByRole("option", { name: /due date/i }));
    expect(defaultProps.onSortFieldChange).toHaveBeenCalledWith(
      BoardSort.DueDate
    );
  });
});
