import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  AssignmentFilter,
  ActionsViewMode,
  StatusVisibility,
  TimeRange,
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
  views: [ActionsViewMode.MyActions],
  viewMode: ActionsViewMode.MyActions,
  onViewModeChange: vi.fn(),
  statusVisibility: StatusVisibility.Open,
  onStatusVisibilityChange: vi.fn(),
  timeRange: TimeRange.AllTime,
  onTimeRangeChange: vi.fn(),
  assignmentFilter: AssignmentFilter.Assigned,
  onAssignmentFilterChange: vi.fn(),
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

  it.each([
    ["coach and colleague", [ActionsViewMode.MyActions, ActionsViewMode.CoacheeActions, ActionsViewMode.ColleagueActions], ["My Actions", "Coachee Actions", "Colleagues' Actions"]],
    ["coach only", [ActionsViewMode.MyActions, ActionsViewMode.CoacheeActions], ["My Actions", "Coachee Actions"]],
    ["colleague only", [ActionsViewMode.MyActions, ActionsViewMode.ColleagueActions], ["My Actions", "Colleagues' Actions"]],
  ])("shows a %s viewer's views in order", (_, views, labels) => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} views={views} />
      </Wrapper>
    );

    expect(screen.getAllByRole("radio").map((item) => item.textContent)).toEqual(labels);
  });

  it("shows no toggle for a coachee, who has only My Actions", () => {
    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    expect(screen.queryByText("My Actions")).not.toBeInTheDocument();
  });

  it("renders status visibility controls inside filter popover", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    // Open the filter popover
    await user.click(screen.getByRole("button", { name: /filters/i }));

    expect(screen.getByText("Open")).toBeInTheDocument();
    // "All" appears in both Status and Assignment toggles
    expect(screen.getAllByText("All").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("calls onStatusVisibilityChange when toggling", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageHeader {...defaultProps} />
      </Wrapper>
    );

    // Open the filter popover first
    await user.click(screen.getByRole("button", { name: /filters/i }));
    // "All" appears in both Status and Assignment toggles — Status is first
    const allButtons = screen.getAllByText("All");
    await user.click(allButtons[0]);
    expect(defaultProps.onStatusVisibilityChange).toHaveBeenCalledWith(
      StatusVisibility.All
    );
  });

  it("calls onViewModeChange with the picked view", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageHeader
          {...defaultProps}
          views={[ActionsViewMode.MyActions, ActionsViewMode.ColleagueActions]}
        />
      </Wrapper>
    );

    await user.click(screen.getByText("Colleagues' Actions"));
    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith(
      ActionsViewMode.ColleagueActions
    );
  });

});
