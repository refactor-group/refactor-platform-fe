import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { maxActiveGoals } from "@/types/goal";
import { GoalProgress } from "@/types/goal-progress";
import type { GoalWithProgress } from "@/types/goal-progress";
import { ItemStatus } from "@/types/general";
import { Some, None } from "@/types/option";

// ── Hook mocks ─────────────────────────────────────────────────────────
const mockUseGoalProgressList = vi.fn();
vi.mock("@/lib/api/goal-progress", () => ({
  useGoalProgressList: (...args: unknown[]) => mockUseGoalProgressList(...args),
}));

const mockUseTodaysSessions = vi.fn();
vi.mock("@/lib/hooks/use-todays-sessions", () => ({
  useTodaysSessions: () => mockUseTodaysSessions(),
}));

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

// Session utilities are pure; we mock them to isolate the card's behavior
// (their own tests cover participant-name resolution).
const mockSelectNextUpcomingSession = vi.fn();
const mockGetSessionParticipantName = vi.fn();
vi.mock("@/lib/utils/session", () => ({
  selectNextUpcomingSession: (...args: unknown[]) =>
    mockSelectNextUpcomingSession(...args),
  getSessionParticipantName: (...args: unknown[]) =>
    mockGetSessionParticipantName(...args),
}));

// ── Fixtures ───────────────────────────────────────────────────────────
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
      linked_coaching_session_count: 2,
      progress: GoalProgress.SolidMomentum,
      last_coaching_session_date: Some("2026-02-20"),
      next_action_due: None,
    },
    ...overrides,
  };
}

/**
 * A minimal upcoming session shape — only the fields the card reads directly.
 * `linkedGoalIds` populates `goals` with the matching IDs so the card's
 * intersection logic has something to pick up from the progress list.
 */
function makeUpcomingSession(linkedGoalIds: string[] = []) {
  return {
    coaching_relationship_id: "rel-1",
    organization: { id: "org-1" },
    goals: linkedGoalIds.map((id) => ({ id })),
  };
}

/**
 * Default: a logged-in user with an upcoming session resolvable to "Alex
 * Chen". `linkedGoalIds` drives which goals the session has linked — the
 * card shows only those.
 */
function setupDefault(linkedGoalIds: string[] = []) {
  const session = makeUpcomingSession(linkedGoalIds);
  mockAuthStore.mockReturnValue({ userId: "user-1" });
  mockUseTodaysSessions.mockReturnValue({
    sessions: [session],
    isLoading: false,
    error: undefined,
    refresh: vi.fn(),
  });
  mockSelectNextUpcomingSession.mockReturnValue(session);
  mockGetSessionParticipantName.mockReturnValue("Alex Chen");
}

describe("GoalsOverviewCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading skeleton while today's sessions are loading", () => {
    mockAuthStore.mockReturnValue({ userId: "user-1" });
    mockUseTodaysSessions.mockReturnValue({
      sessions: [],
      isLoading: true,
      error: undefined,
      refresh: vi.fn(),
    });
    mockSelectNextUpcomingSession.mockReturnValue(undefined);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    const { container } = render(<GoalsOverviewCard />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders the empty state when there is no upcoming session", () => {
    mockAuthStore.mockReturnValue({ userId: "user-1" });
    mockUseTodaysSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: undefined,
      refresh: vi.fn(),
    });
    mockSelectNextUpcomingSession.mockReturnValue(undefined);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText("No active goals to show")).toBeInTheDocument();
  });

  it("renders nothing on goals-progress error (silent fallback)", () => {
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: new Error("fetch failed"),
      refresh: vi.fn(),
    });

    const { container } = render(<GoalsOverviewCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the coachee name and the session-linked goal count", () => {
    const goals = [
      makeGoalWithProgress({ goal_id: "g1", title: "Goal A" }),
      makeGoalWithProgress({ goal_id: "g2", title: "Goal B" }),
      makeGoalWithProgress({ goal_id: "g3", title: "Goal C (not linked)" }),
    ];
    setupDefault(["g1", "g2"]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText("Alex Chen's active goals")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Goal A")).toBeInTheDocument();
    expect(screen.getByText("Goal B")).toBeInTheDocument();
    expect(screen.queryByText("Goal C (not linked)")).not.toBeInTheDocument();
  });

  it("intersects progress list with the session's linked goal IDs", () => {
    // The card renders the same goals the Upcoming Session card shows —
    // whatever is linked to that session via the join table, regardless of
    // status.
    const goals = [
      makeGoalWithProgress({ goal_id: "g1", title: "In progress", status: ItemStatus.InProgress }),
      makeGoalWithProgress({ goal_id: "g2", title: "Not started", status: ItemStatus.NotStarted }),
      makeGoalWithProgress({ goal_id: "g3", title: "On hold", status: ItemStatus.OnHold }),
      makeGoalWithProgress({ goal_id: "g4", title: "Completed", status: ItemStatus.Completed }),
      makeGoalWithProgress({ goal_id: "g5", title: "Won't do", status: ItemStatus.WontDo }),
    ];
    // Session links three of them — any status is fair game.
    setupDefault(["g2", "g4", "g5"]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Won't do")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    expect(screen.queryByText("On hold")).not.toBeInTheDocument();
  });

  it("defensively caps the display at maxActiveGoals()", () => {
    // Session shouldn't normally have more linked goals than the product
    // limit, but if it ever does (stale data, backend drift), the card caps
    // to the same active-goal max.
    const goals = Array.from({ length: 7 }, (_, i) =>
      makeGoalWithProgress({ goal_id: `g${i + 1}`, title: `Goal ${i + 1}` })
    );
    setupDefault(goals.map((g) => g.goal_id));
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText(String(maxActiveGoals()))).toBeInTheDocument();
    expect(screen.getByText("Goal 1")).toBeInTheDocument();
    expect(screen.getByText("Goal 2")).toBeInTheDocument();
    expect(screen.getByText("Goal 3")).toBeInTheDocument();
    expect(screen.queryByText("Goal 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Goal 7")).not.toBeInTheDocument();
  });

  it("shows 'No active goals' when the session has no linked goals", () => {
    setupDefault([]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [makeGoalWithProgress({ goal_id: "unrelated" })],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText("No active goals")).toBeInTheDocument();
  });

  it("computes aggregate percentage across only the session-linked goals", () => {
    const goals = [
      makeGoalWithProgress({
        goal_id: "linked-a",
        progress_metrics: {
          actions_completed: 6,
          actions_total: 8,
          linked_coaching_session_count: 3,
          progress: GoalProgress.SolidMomentum,
          last_coaching_session_date: None,
          next_action_due: None,
        },
      }),
      makeGoalWithProgress({
        goal_id: "linked-b",
        progress_metrics: {
          actions_completed: 2,
          actions_total: 6,
          linked_coaching_session_count: 1,
          progress: GoalProgress.SolidMomentum,
          last_coaching_session_date: None,
          next_action_due: None,
        },
      }),
      // Unlinked — should NOT influence the aggregate.
      makeGoalWithProgress({
        goal_id: "unlinked",
        progress_metrics: {
          actions_completed: 100,
          actions_total: 100,
          linked_coaching_session_count: 5,
          progress: GoalProgress.SolidMomentum,
          last_coaching_session_date: None,
          next_action_due: None,
        },
      }),
    ];
    setupDefault(["linked-a", "linked-b"]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    // (6+2)/(8+6) = 8/14 = 57% — unlinked goal excluded
    expect(screen.getByText("57%")).toBeInTheDocument();
  });

  it("shows worst health signal across session-linked goals", () => {
    const goals = [
      makeGoalWithProgress({
        goal_id: "g1",
        progress_metrics: {
          actions_completed: 6,
          actions_total: 8,
          linked_coaching_session_count: 3,
          progress: GoalProgress.SolidMomentum,
          last_coaching_session_date: None,
          next_action_due: None,
        },
      }),
      makeGoalWithProgress({
        goal_id: "g2",
        progress_metrics: {
          actions_completed: 1,
          actions_total: 6,
          linked_coaching_session_count: 1,
          progress: GoalProgress.NeedsAttention,
          last_coaching_session_date: None,
          next_action_due: None,
        },
      }),
    ];
    setupDefault(["g1", "g2"]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("toggles collapsible content when header is clicked", async () => {
    const user = userEvent.setup();
    const goals = [makeGoalWithProgress({ goal_id: "g1", title: "My goal" })];
    setupDefault(["g1"]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);

    expect(screen.getByText("My goal")).toBeVisible();

    const trigger = screen.getByRole("button", { name: /active goals/i });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("data-state", "closed");
  });

  it("does not render a 'View all goals' link (deferred until Goals page lands)", () => {
    const goals = [makeGoalWithProgress({ goal_id: "g1" })];
    setupDefault(["g1"]);
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(
      screen.queryByRole("button", { name: /view all goals/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /view all goals/i })
    ).not.toBeInTheDocument();
  });

  it("fetches the relationship's full progress list (no server-side filter)", () => {
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    // Card intersects with session.goals client-side, so it asks the server
    // for the full relationship-scoped list — no status / sort / limit.
    expect(mockUseGoalProgressList).toHaveBeenCalledWith("org-1", "rel-1");
  });
});
