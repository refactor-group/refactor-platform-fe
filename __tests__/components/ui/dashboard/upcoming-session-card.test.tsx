import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DateTime } from "ts-luxon";
import {
  createMockEnrichedSession,
  createEnrichedSessionAt,
  createMockGoal,
} from "../../../test-utils";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { ItemStatus } from "@/types/general";
import { None } from "@/types/option";

/**
 * Test Suite: UpcomingSessionCard
 * Story: "Show the viewer the next session they should act on today, or an
 * invitation to schedule one when none remain."
 */

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockUseAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector(mockUseAuthStore()),
}));

const mockUseTodaysSessions = vi.fn();
vi.mock("@/lib/hooks/use-todays-sessions", () => ({
  useTodaysSessions: () => mockUseTodaysSessions(),
}));

const mockUseAssignedActions = vi.fn();
vi.mock("@/lib/hooks/use-assigned-actions", () => ({
  useAssignedActions: () => mockUseAssignedActions(),
}));

// Import after mocks are registered.
import { UpcomingSessionCard } from "@/components/ui/dashboard/upcoming-session-card";

// ── Helpers ──────────────────────────────────────────────────────────

const baseAuthState = {
  userSession: {
    id: "coach-1",
    first_name: "Jim",
    last_name: "Hodapp",
    display_name: "Jim Hodapp",
    timezone: "America/Los_Angeles",
    role: "coach",
    roles: [],
  },
  isACoach: true,
};

function setAuth(state = baseAuthState) {
  mockUseAuthStore.mockReturnValue(state);
}

function setSessions(sessions: EnrichedCoachingSession[], overrides?: { isLoading?: boolean; error?: unknown }) {
  mockUseTodaysSessions.mockReturnValue({
    sessions,
    isLoading: overrides?.isLoading ?? false,
    error: overrides?.error ?? null,
    refresh: vi.fn(),
  });
}

function setAssignedActions(flatActions: AssignedActionWithContext[] = []) {
  mockUseAssignedActions.mockReturnValue({
    flatActions,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  });
}

function makeActionContext(relationshipId: string, dueBy: DateTime): AssignedActionWithContext {
  return {
    action: {
      id: `action-${Math.random()}`,
      coaching_session_id: "session-1",
      goal_id: None,
      body: "Follow up on last action",
      user_id: "coach-1",
      status: ItemStatus.NotStarted,
      status_changed_at: DateTime.now(),
      due_by: dueBy,
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
      assignee_ids: ["coach-1"],
    },
    relationship: {
      id: relationshipId,
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      coach_first_name: "Jim",
      coach_last_name: "Hodapp",
      coachee_first_name: "Alex",
      coachee_last_name: "Chen",
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    },
    goal: { goalId: "goal-1", title: "Goal" },
    sourceSession: { coachingSessionId: "session-1", sessionDate: dueBy },
    nextSession: null,
    isOverdue: false,
  };
}

beforeEach(() => {
  setAuth();
  setSessions([]);
  setAssignedActions([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe("UpcomingSessionCard — populated state", () => {
  it("renders the UPCOMING SESSION eyebrow", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText(/upcoming session/i)).toBeInTheDocument();
  });

  it("selects the first non-past session from a mixed list", () => {
    const past = createEnrichedSessionAt(-120, {
      id: "past",
      coaching_relationship_id: "rel-1",
      coachee: {
        id: "coachee-past",
        email: "p@example.com",
        first_name: "Past",
        last_name: "Person",
        display_name: "Past Person",
        timezone: "America/Los_Angeles",
        role: "user",
        roles: [],
        created_at: "",
        updated_at: "",
      },
    });
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([past, imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    // Alex Chen is the default coachee on the fixture; when viewer is coach-1,
    // the participant shown should be Alex (from the imminent session), not
    // Past Person (from the past session).
    expect(screen.getByText(/Session with Alex Chen/)).toBeInTheDocument();
    expect(screen.queryByText(/Past Person/)).not.toBeInTheDocument();
  });

  it("renders the stacked time and duration line", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    // Duration defaults to 60 minutes until backend supports per-session duration.
    expect(screen.getByText("60 min")).toBeInTheDocument();
  });

  it("shows avatar initials for the counterpart", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText("AC")).toBeInTheDocument();
  });

  it("shows the count of actions due on or before the session", () => {
    const sessionDate = DateTime.now().plus({ minutes: 15 });
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
      date: sessionDate.toISO() ?? "",
    });
    setSessions([imminent]);
    setAssignedActions([
      makeActionContext("rel-1", sessionDate.minus({ hours: 1 })),
      makeActionContext("rel-1", sessionDate.minus({ days: 1 })),
      // Wrong relationship — must be filtered out.
      makeActionContext("rel-other", sessionDate.minus({ hours: 1 })),
      // Due after the session — must be filtered out.
      makeActionContext("rel-1", sessionDate.plus({ days: 1 })),
    ]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText("2 actions due")).toBeInTheDocument();
  });

  it("renders a goal row per linked goal", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
      goals: [
        createMockGoal({ id: "g1", title: "Improve technical leadership" }),
        createMockGoal({ id: "g2", title: "Build public speaking confidence" }),
      ],
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText("Improve technical leadership")).toBeInTheDocument();
    expect(screen.getByText("Build public speaking confidence")).toBeInTheDocument();
  });

  it("renders the urgency message", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText(/Starting in 15 minutes/)).toBeInTheDocument();
  });

  it("shows a pulsing dot for Imminent sessions", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    const { container } = render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    // PulsingDot contains a uniquely-classed animate-ping element.
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("hides the pulsing dot for Later sessions", () => {
    const later = createEnrichedSessionAt(60 * 4, {
      id: "later",
      coaching_relationship_id: "rel-1",
    });
    setSessions([later]);

    const { container } = render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();
  });

  it("shows the Reschedule button when the viewer is the coach", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} onReschedule={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: /reschedule/i })
    ).toBeInTheDocument();
  });

  it("hides the Reschedule button when the viewer is the coachee", () => {
    setAuth({
      ...baseAuthState,
      userSession: { ...baseAuthState.userSession, id: "coachee-1" },
      isACoach: false,
    });
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} onReschedule={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /reschedule/i })
    ).not.toBeInTheDocument();
  });

  it("fires onReschedule with the selected session when Reschedule is clicked", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);
    const handleReschedule = vi.fn();

    render(<UpcomingSessionCard onCreateSession={vi.fn()} onReschedule={handleReschedule} />);
    fireEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    expect(handleReschedule).toHaveBeenCalledWith(imminent);
  });

  it("links the Join button to the coaching session page", () => {
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
    });
    setSessions([imminent]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    const join = screen.getByRole("link", { name: /join/i });
    expect(join.getAttribute("href")).toBe("/coaching-sessions/imminent");
  });

  it("renders the empty state when every session is past", () => {
    const past = createEnrichedSessionAt(-120, {
      id: "past",
      coaching_relationship_id: "rel-1",
    });
    setSessions([past]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText("No sessions scheduled for today")).toBeInTheDocument();
  });

  it("renders the empty state when there are no sessions at all", () => {
    setSessions([]);
    const handleCreate = vi.fn();
    render(<UpcomingSessionCard onCreateSession={handleCreate} />);
    fireEvent.click(
      screen.getByRole("button", { name: /schedule a coaching session/i })
    );
    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  it("hides the empty-state schedule button when the viewer cannot create sessions", () => {
    setAuth({ ...baseAuthState, isACoach: false });
    setSessions([]);
    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /schedule a coaching session/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/your coach will schedule your next session/i)
    ).toBeInTheDocument();
  });

  it("renders a loading state while sessions are loading", () => {
    setSessions([], { isLoading: true });
    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText(/loading your upcoming session/i)).toBeInTheDocument();
  });

  it("renders an error state when the sessions fetch errors", () => {
    setSessions([], { error: new Error("boom") });
    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(
      screen.getByText(/couldn't load your upcoming session/i)
    ).toBeInTheDocument();
  });

  it("surfaces the hook's refresh function via onRefreshNeeded", () => {
    const refresh = vi.fn();
    mockUseTodaysSessions.mockReturnValue({
      sessions: [],
      isLoading: false,
      error: null,
      refresh,
    });
    setAssignedActions([]);
    const handleRefreshNeeded = vi.fn();

    act(() => {
      render(
        <UpcomingSessionCard onCreateSession={vi.fn()} onRefreshNeeded={handleRefreshNeeded} />
      );
    });

    expect(handleRefreshNeeded).toHaveBeenCalledWith(refresh);
  });
});
