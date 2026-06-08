// Phase 5 — provenance WIRING test (non-frozen, has teeth).
//
// The frozen `topic-provenance.test.tsx` pins the pure decision helpers
// (`isTopicNew` / `topicWasUpdated`) and the dot's a11y label in isolation.
// This test proves the *host derivation* the plan calls for:
//
//   1. `selectPreviousSessionDate` (the FE-derived previous-session anchor)
//      picks the latest session STRICTLY BEFORE the current one, and is `None`
//      when there is no earlier session. The relationship list endpoint's date
//      filter is BE-ignored, so the panel fetches a wide window and selects
//      client-side — this helper is that selection.
//   2. The panel threads that anchor + an author-name resolver into the row's
//      `TopicAuthorBadge`: a topic authored by the OTHER party AFTER the
//      previous session shows the "new" dot; the badge's initials come from the
//      resolver mapping coach/coachee ids to names.
//
// It fails if the wrong session is chosen, if names are misresolved (initials
// would be "?" or the wrong person's), or if the anchor isn't threaded (no dot).

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { selectPreviousSessionDate } from "@/lib/utils/session";
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { None } from "@/types/option";

// Desktop viewport so the desktop layout renders (mobile sheet stays closed).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 768px)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock("@/lib/api/goals", () => ({
  useGoalsBySession: vi.fn(() => ({ goals: [], isLoading: false, isError: false, refresh: vi.fn() })),
  useGoalList: vi.fn(() => ({ goals: [], isLoading: false, isError: false, refresh: vi.fn() })),
  useGoal: vi.fn(() => ({ goal: undefined, isLoading: false, isError: false, refresh: vi.fn() })),
  useGoalMutation: vi.fn(() => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createNested: vi.fn(),
    deleteNested: vi.fn(),
  })),
  GoalApi: { linkToSession: vi.fn(), unlinkFromSession: vi.fn() },
}));

vi.mock("@/lib/api/agreements", () => ({
  useAgreementList: vi.fn(() => ({ agreements: [], isLoading: false, isError: false, refresh: vi.fn() })),
  useAgreementMutation: vi.fn(() => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isLoading: false,
    error: null,
  })),
}));

vi.mock("@/lib/api/coaching-session-topics", () => ({
  useCoachingSessionTopicList: vi.fn(),
  useCoachingSessionTopicMutation: vi.fn(() => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    isLoading: false,
    error: null,
  })),
}));

vi.mock("@/lib/api/goal-progress", () => ({
  useGoalProgress: vi.fn(() => ({
    progressMetrics: undefined,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
}));

let mockUserId = "coachee-1";
vi.mock("@/components/ui/coaching-sessions/editor-cache-context", () => ({
  useEditorCache: () => ({
    insertHeadingIntoNotes: vi.fn(() => true),
    registerEditor: vi.fn(),
    presenceState: { users: new Map(), currentUser: null, isLoading: false },
  }),
}));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: vi.fn((selector: (state: any) => any) => selector({ userId: mockUserId })),
}));

vi.mock("@/lib/hooks/use-current-coaching-session", () => ({
  useCurrentCoachingSession: vi.fn(() => ({
    currentCoachingSessionId: "session-1",
    currentCoachingSession: { id: "session-1", date: "2026-06-07T10:00:00.000Z", coaching_relationship_id: "rel-1" },
    isError: false,
    isLoading: false,
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/hooks/use-current-coaching-relationship", () => ({
  useCurrentCoachingRelationship: vi.fn(() => ({
    currentCoachingRelationshipId: "rel-1",
    currentCoachingRelationship: {
      id: "rel-1",
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      coach_first_name: "Jim",
      coach_last_name: "Hodapp",
      coachee_first_name: "Caleb",
      coachee_last_name: "Bourg",
    },
    isLoading: false,
    isError: false,
    setCurrentCoachingRelationshipId: vi.fn(),
    refresh: vi.fn(),
  })),
}));

vi.mock("@/lib/api/actions", () => ({
  useActionMutation: vi.fn(() => ({ create: vi.fn(), update: vi.fn(), delete: vi.fn(), isLoading: false, error: null })),
}));

vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: vi.fn(() => ({ actions: [], isLoading: false, isError: false, refresh: vi.fn() })),
}));

vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: vi.fn(() => ({ coachingSessions: [], isLoading: false, isError: false, refresh: vi.fn() })),
}));

vi.mock("@/site.config", () => ({
  siteConfig: { locale: "en-US", env: { backendServiceURL: "http://localhost:3000" } },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

import { useCoachingSessionTopicList } from "@/lib/api/coaching-session-topics";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

function setTopics(topics: CoachingSessionTopic[]) {
  vi.mocked(useCoachingSessionTopicList).mockReturnValue({
    topics,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  });
}

function setRelationshipSessions(dates: string[]) {
  vi.mocked(useCoachingSessionList).mockReturnValue({
    coachingSessions: dates.map((date, i) => ({ id: `s${i}`, date })) as any,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  });
}

function renderPanel() {
  return render(
    <CoachingSessionPanel
      coachingSessionId="session-1"
      coachingRelationshipId="rel-1"
      noteSelection={None}
    />
  );
}

// ── 1. Pure previous-session selection ────────────────────────────────

describe("selectPreviousSessionDate — latest session strictly before current", () => {
  const dt = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

  it("picks the latest session strictly before the current date", () => {
    const current = dt("2026-06-07T10:00:00.000Z");
    const result = selectPreviousSessionDate(
      [
        { date: "2026-05-10T10:00:00.000Z" },
        { date: "2026-05-31T17:00:00.000Z" }, // expected previous
        { date: "2026-04-01T09:00:00.000Z" },
      ],
      current
    );
    expect(result.some).toBe(true);
    if (result.some) {
      expect(result.val.toUTC().toISO()).toBe(
        dt("2026-05-31T17:00:00.000Z").toUTC().toISO()
      );
    }
  });

  it("ignores the current and any future sessions", () => {
    const current = dt("2026-06-07T10:00:00.000Z");
    const result = selectPreviousSessionDate(
      [
        { date: "2026-06-07T10:00:00.000Z" }, // the current one — excluded (not strictly before)
        { date: "2026-06-21T10:00:00.000Z" }, // future
        { date: "2026-05-24T10:00:00.000Z" }, // expected previous
      ],
      current
    );
    expect(result.some).toBe(true);
    if (result.some) {
      expect(result.val.toUTC().toISO()).toBe(
        dt("2026-05-24T10:00:00.000Z").toUTC().toISO()
      );
    }
  });

  it("is None when there is no earlier session", () => {
    const current = dt("2026-06-07T10:00:00.000Z");
    expect(
      selectPreviousSessionDate([{ date: "2026-06-21T10:00:00.000Z" }], current).none
    ).toBe(true);
    expect(selectPreviousSessionDate([], current).none).toBe(true);
  });
});

// ── 2. Panel threads anchor + resolver into the badge ─────────────────

describe("CoachingSessionPanel — provenance wiring", () => {
  const originalNow = Settings.now;
  const fakeNow = DateTime.fromISO("2026-06-07T12:00:00.000Z", { zone: "utc" });

  beforeEach(() => {
    vi.clearAllMocks();
    Settings.now = () => fakeNow.toMillis();
    mockUserId = "coachee-1";
    setRelationshipSessions([
      "2026-05-31T17:00:00.000Z", // previous session (before current 2026-06-07)
      "2026-06-07T10:00:00.000Z", // the current session itself
    ]);
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it("shows the 'new' dot for the OTHER party's topic created after the previous session", () => {
    setTopics([
      topic({
        id: "t1",
        user_id: "coach-1", // not the viewer (coachee-1)
        body: "Discuss the promotion path",
        created_at: DateTime.fromISO("2026-06-03T09:00:00.000Z", { zone: "utc" }),
      }),
    ]);
    renderPanel();
    // Both layouts render in the DOM (mobile hidden via CSS); the dot's sr-only
    // label is present in each, so there is at least one match.
    expect(
      screen.getAllByText(/new since your last session/i).length
    ).toBeGreaterThan(0);
  });

  it("does NOT show the 'new' dot for the viewer's own topic", () => {
    setTopics([
      topic({
        id: "t1",
        user_id: "coachee-1", // the viewer
        body: "My own topic",
        created_at: DateTime.fromISO("2026-06-03T09:00:00.000Z", { zone: "utc" }),
      }),
    ]);
    renderPanel();
    expect(
      screen.queryByText(/new since your last session/i)
    ).not.toBeInTheDocument();
  });

  it("does NOT show the 'new' dot when there is no previous session", () => {
    setRelationshipSessions(["2026-06-07T10:00:00.000Z"]); // only the current
    setTopics([
      topic({
        id: "t1",
        user_id: "coach-1",
        body: "Discuss the promotion path",
        created_at: DateTime.fromISO("2026-06-03T09:00:00.000Z", { zone: "utc" }),
      }),
    ]);
    renderPanel();
    expect(
      screen.queryByText(/new since your last session/i)
    ).not.toBeInTheDocument();
  });

  it("resolves the author's name: a coach-authored topic renders the coach's initials", () => {
    setTopics([
      topic({ id: "t1", user_id: "coach-1", body: "Reorg" }),
    ]);
    renderPanel();
    // "Jim Hodapp" → "JH" (not "?" and not the coachee's "CB").
    expect(screen.getAllByText("JH").length).toBeGreaterThan(0);
    expect(screen.queryByText("CB")).not.toBeInTheDocument();
  });

  it("resolves the author's name: a coachee-authored topic renders the coachee's initials", () => {
    setTopics([
      topic({ id: "t1", user_id: "coachee-1", body: "Reorg" }),
    ]);
    renderPanel();
    // "Caleb Bourg" → "CB".
    expect(screen.getAllByText("CB").length).toBeGreaterThan(0);
    expect(screen.queryByText("JH")).not.toBeInTheDocument();
  });
});
