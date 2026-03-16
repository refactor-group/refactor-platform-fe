import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { GoalProgress } from "@/types/goal-progress";
import type { GoalWithProgress } from "@/types/goal-progress";
import { ItemStatus } from "@/types/general";
import { Some, None } from "@/types/option";

// Mock the API hook
const mockUseGoalProgressList = vi.fn();
vi.mock("@/lib/api/goal-progress", () => ({
  useGoalProgressList: (...args: unknown[]) => mockUseGoalProgressList(...args),
}));

function makeGoalWithProgress(
  overrides: Partial<GoalWithProgress> = {}
): GoalWithProgress {
  return {
    goal_id: `goal-${Math.random().toString(36).slice(2)}`,
    coaching_relationship_id: "rel-1",
    title: "Test goal",
    body: "Test body",
    status: ItemStatus.InProgress,
    status_changed_at: "2026-02-01T00:00:00Z",
    target_date: null,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-02-20T00:00:00Z",
    progress_metrics: {
      actions_completed: 3,
      actions_total: 5,
      linked_session_count: 2,
      progress: GoalProgress.SolidMomentum,
      last_session_date: Some("2026-02-20"),
      next_action_due: None,
    },
    ...overrides,
  };
}

const defaultProps = {
  organizationId: "org-1",
  relationshipId: "rel-1",
  coacheeName: "Alex Chen",
};

describe("GoalsOverviewCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton when data is loading", () => {
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: true,
      isError: undefined,
      refresh: vi.fn(),
    });

    const { container } = render(<GoalsOverviewCard {...defaultProps} />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders nothing on error (silent fallback)", () => {
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: new Error("fetch failed"),
      refresh: vi.fn(),
    });

    const { container } = render(<GoalsOverviewCard {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the coachee name and active goal count", () => {
    const goals = [
      makeGoalWithProgress({ title: "Goal A" }),
      makeGoalWithProgress({ title: "Goal B" }),
    ];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);
    expect(screen.getByText("Alex Chen's active goals")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("filters out non-InProgress goals", () => {
    const goals = [
      makeGoalWithProgress({ title: "Active goal", status: ItemStatus.InProgress }),
      makeGoalWithProgress({ title: "Completed goal", status: ItemStatus.Completed }),
      makeGoalWithProgress({ title: "Not started goal", status: ItemStatus.NotStarted }),
    ];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);
    // Only 1 active goal
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Active goal")).toBeInTheDocument();
    expect(screen.queryByText("Completed goal")).not.toBeInTheDocument();
    expect(screen.queryByText("Not started goal")).not.toBeInTheDocument();
  });

  it("shows 'No active goals' when no goals are InProgress", () => {
    const goals = [
      makeGoalWithProgress({ status: ItemStatus.Completed }),
    ];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);
    expect(screen.getByText("No active goals")).toBeInTheDocument();
  });

  it("computes correct aggregate percentage", () => {
    const goals = [
      makeGoalWithProgress({
        progress_metrics: {
          actions_completed: 6,
          actions_total: 8,
          linked_session_count: 3,
          progress: GoalProgress.SolidMomentum,
          last_session_date: None,
          next_action_due: None,
        },
      }),
      makeGoalWithProgress({
        progress_metrics: {
          actions_completed: 2,
          actions_total: 6,
          linked_session_count: 1,
          progress: GoalProgress.SolidMomentum,
          last_session_date: None,
          next_action_due: None,
        },
      }),
    ];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);
    // (6+2)/(8+6) = 8/14 = 57%
    expect(screen.getByText("57%")).toBeInTheDocument();
  });

  it("shows worst health signal across goals", () => {
    const goals = [
      makeGoalWithProgress({
        progress_metrics: {
          actions_completed: 6,
          actions_total: 8,
          linked_session_count: 3,
          progress: GoalProgress.SolidMomentum,
          last_session_date: None,
          next_action_due: None,
        },
      }),
      makeGoalWithProgress({
        progress_metrics: {
          actions_completed: 1,
          actions_total: 6,
          linked_session_count: 1,
          progress: GoalProgress.NeedsAttention,
          last_session_date: None,
          next_action_due: None,
        },
      }),
    ];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("toggles collapsible content when header is clicked", async () => {
    const user = userEvent.setup();
    const goals = [makeGoalWithProgress({ title: "My goal" })];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);

    // Initially expanded — goal row should be visible
    expect(screen.getByText("My goal")).toBeVisible();

    // Click to collapse
    const trigger = screen.getByRole("button", {
      name: /active goals/i,
    });
    await user.click(trigger);

    // After collapse, the trigger button should indicate closed state
    expect(trigger).toHaveAttribute("data-state", "closed");
  });

  it("renders 'View all goals' button as disabled", () => {
    const goals = [makeGoalWithProgress()];
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard {...defaultProps} />);
    const viewAllButton = screen.getByRole("button", {
      name: /view all goals/i,
    });
    expect(viewAllButton).toBeDisabled();
  });

  it("passes correct IDs to the hook", () => {
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(
      <GoalsOverviewCard
        organizationId="org-42"
        relationshipId="rel-99"
        coacheeName="Test"
      />
    );
    expect(mockUseGoalProgressList).toHaveBeenCalledWith("org-42", "rel-99");
  });
});
