import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { AssigneeScope } from "@/types/assigned-actions";
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

/** A minimal upcoming session shape — only the fields the card reads directly. */
function makeUpcomingSession() {
  return {
    id: "sess-1",
    coaching_relationship_id: "rel-1",
    organization: { id: "org-1" },
  };
}

/**
 * Default: a logged-in user with an upcoming session resolvable to "Alex
 * Chen". The card trusts the server's response — tests mock whatever goals
 * the server would return for `?coaching_session_id=sess-1&assignee=coachee`.
 */
function setupDefault() {
  const session = makeUpcomingSession();
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

  it("renders an inline error message when goal_progress fails", () => {
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: new Error("fetch failed"),
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(
      screen.getByText(/couldn[’']t load active goals\. please refresh/i)
    ).toBeInTheDocument();
  });

  it("renders the coachee name and the goal count returned by the server", () => {
    // Card trusts the server's filtered+scoped response — whatever goals it
    // gets back are the goals it renders.
    const goals = [
      makeGoalWithProgress({ goal_id: "g1", title: "Goal A" }),
      makeGoalWithProgress({ goal_id: "g2", title: "Goal B" }),
    ];
    setupDefault();
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
  });

  it("shows 'No active goals' when the server returns an empty list", () => {
    // Session has no linked goals (or none match the assignee scope) → server
    // returns []. Card shows the inline empty-state copy.
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.getByText("No active goals")).toBeInTheDocument();
  });

  it("computes aggregate percentage across the returned goals", () => {
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
          actions_completed: 2,
          actions_total: 6,
          linked_coaching_session_count: 1,
          progress: GoalProgress.SolidMomentum,
          last_coaching_session_date: None,
          next_action_due: None,
        },
      }),
    ];
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: goals,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    // (6+2)/(8+6) = 8/14 = 57%
    expect(screen.getByText("57%")).toBeInTheDocument();
  });

  it("shows worst health signal across returned goals", () => {
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
    setupDefault();
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
    setupDefault();
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
    setupDefault();
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

  it("asks the server for session-linked + coachee-scoped progress metrics", () => {
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    // Server filters + scopes in one round trip — no client-side intersect
    // or count override needed. Card passes the upcoming session's id and
    // AssigneeScope.Coachee (RelationshipGoalProgress v4).
    expect(mockUseGoalProgressList).toHaveBeenCalledWith(
      Some("org-1"),
      Some("rel-1"),
      {
        coaching_session_id: "sess-1",
        assignee: AssigneeScope.Coachee,
      }
    );
  });

  it("hides the health signal when the server returns an empty list", () => {
    // aggregateProgress([]) defaults to SolidMomentum; without the
    // length-guard a misleading "Solid momentum" badge would flash next to
    // the count of 0.
    setupDefault();
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(screen.queryByText("Solid momentum")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs attention")).not.toBeInTheDocument();
    expect(screen.queryByText(/refocus/i)).not.toBeInTheDocument();
  });

  it("passes None Options to the hook when the upcoming session has no organization/relationship", () => {
    // Partially-hydrated enriched session (no `organization` on the include
    // or a race where the data hasn't landed). The card should pass None so
    // the hook skips the fetch rather than blowing up.
    mockAuthStore.mockReturnValue({ userId: "user-1" });
    const partial = { id: "sess-1" }; // no organization, no coaching_relationship_id
    mockUseTodaysSessions.mockReturnValue({
      sessions: [partial],
      isLoading: false,
      error: undefined,
      refresh: vi.fn(),
    });
    mockSelectNextUpcomingSession.mockReturnValue(partial);
    mockGetSessionParticipantName.mockReturnValue("Alex Chen");
    mockUseGoalProgressList.mockReturnValue({
      goalsWithProgress: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });

    render(<GoalsOverviewCard />);
    expect(mockUseGoalProgressList).toHaveBeenCalledWith(None, None, {
      coaching_session_id: "sess-1",
      assignee: AssigneeScope.Coachee,
    });
  });
});
