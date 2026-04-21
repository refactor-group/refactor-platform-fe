import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DateTime } from "ts-luxon";
import {
  createEnrichedSessionAt,
  createMockGoal,
} from "../../../test-utils";
import type { EnrichedCoachingSession, CoachingSession } from "@/types/coaching-session";
import type { Action } from "@/types/action";
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

const mockUseUserActionsList = vi.fn();
vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: () => mockUseUserActionsList(),
}));

const mockUseCoachingSessionList = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: () => mockUseCoachingSessionList(),
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

function setRelationshipActions(actions: Action[] = []) {
  mockUseUserActionsList.mockReturnValue({
    actions,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  });
}

function setRelationshipSessionList(sessions: CoachingSession[] = []) {
  mockUseCoachingSessionList.mockReturnValue({
    coachingSessions: sessions,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  });
}

function makeAction(overrides: Partial<Action> & { coaching_session_id: string; due_by: DateTime }): Action {
  return {
    id: overrides.id ?? `action-${Math.random()}`,
    coaching_session_id: overrides.coaching_session_id,
    goal_id: None,
    body: "some action",
    user_id: "coach-1",
    status: ItemStatus.NotStarted,
    status_changed_at: DateTime.now(),
    due_by: overrides.due_by,
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
    assignee_ids: ["coach-1"],
    ...overrides,
  };
}

beforeEach(() => {
  setAuth();
  setSessions([]);
  setRelationshipActions([]);
  setRelationshipSessionList([]);
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

  it("shows the count of actions carried forward into this session (matches panel Due tab)", () => {
    const sessionDate = DateTime.now().plus({ minutes: 15 });
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
      date: sessionDate.toISO() ?? "",
    });
    setSessions([imminent]);

    // The panel's Due tab shows actions where coaching_session_id !== current
    // session and due_by is within [previousSessionDate, currentSessionDate].
    // Tell the card the previous session was yesterday.
    const prev: CoachingSession = {
      id: "prev-session",
      coaching_relationship_id: "rel-1",
      date: sessionDate.minus({ days: 3 }).toISO() ?? "",
      created_at: DateTime.now(),
      updated_at: DateTime.now(),
    };
    setRelationshipSessionList([prev]);

    setRelationshipActions([
      // Carried forward — due within the window, different source session
      makeAction({ id: "a1", coaching_session_id: "other-1", due_by: sessionDate.minus({ hours: 1 }) }),
      makeAction({ id: "a2", coaching_session_id: "other-2", due_by: sessionDate.minus({ days: 2 }) }),
      // Created in this session — excluded (would appear on the New tab, not Due)
      makeAction({ id: "a3", coaching_session_id: "imminent", due_by: sessionDate.minus({ hours: 1 }) }),
      // Due after the session — excluded
      makeAction({ id: "a4", coaching_session_id: "other-3", due_by: sessionDate.plus({ days: 1 }) }),
      // Due before the previous session — excluded
      makeAction({ id: "a5", coaching_session_id: "other-4", due_by: sessionDate.minus({ days: 10 }) }),
    ]);

    render(<UpcomingSessionCard onCreateSession={vi.fn()} />);
    expect(screen.getByText("2 actions due")).toBeInTheDocument();
  });

  it("includes Completed actions in the count (matches panel Due tab — Completed still shows up for review)", () => {
    const sessionDate = DateTime.now().plus({ minutes: 15 });
    const imminent = createEnrichedSessionAt(15, {
      id: "imminent",
      coaching_relationship_id: "rel-1",
      date: sessionDate.toISO() ?? "",
    });
    setSessions([imminent]);
    setRelationshipSessionList([]); // No previous session → window is open-ended back

    setRelationshipActions([
      makeAction({ id: "a1", coaching_session_id: "other-1", due_by: sessionDate.minus({ hours: 1 }), status: ItemStatus.Completed }),
      makeAction({ id: "a2", coaching_session_id: "other-2", due_by: sessionDate.minus({ hours: 2 }), status: ItemStatus.NotStarted }),
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
    setRelationshipActions([]);
    setRelationshipSessionList([]);
    const handleRefreshNeeded = vi.fn();

    act(() => {
      render(
        <UpcomingSessionCard onCreateSession={vi.fn()} onRefreshNeeded={handleRefreshNeeded} />
      );
    });

    expect(handleRefreshNeeded).toHaveBeenCalledWith(refresh);
  });
});
