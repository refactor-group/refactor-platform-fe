// Provenance WIRING test (non-frozen, has teeth).
//
// The frozen `topic-provenance.test.tsx` pins the pure decision helper
// (`isTopicNew`) and the dot's a11y label in isolation. This test proves the
// *host derivation* under CoachingSessionViews: the panel marks the session
// viewed on open (exactly once) and threads the returned PRIOR last-viewed
// marker into the row's `TopicAuthorBadge` as the unread anchor — a topic
// authored by the OTHER party AFTER that marker shows the "new since your last
// visit" dot; the badge's initials come from the author-name resolver.

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { Some, None } from "@/types/option";

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

// The panel marks the session viewed on open; the returned prior marker is the
// unread anchor. Mock it so we control the anchor deterministically.
vi.mock("@/lib/api/coaching-session-views", () => ({
  CoachingSessionViewApi: { markViewed: vi.fn() },
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
    insertTextIntoNotes: vi.fn(() => true),
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

vi.mock("@/site.config", () => ({
  siteConfig: { locale: "en-US", env: { backendServiceURL: "http://localhost:3000" } },
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

import { useCoachingSessionTopicList } from "@/lib/api/coaching-session-topics";
import { CoachingSessionViewApi } from "@/lib/api/coaching-session-views";

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

// Control the viewer's PRIOR last-viewed marker (the unread anchor). `null`
// models a never-viewed session (first open).
function setLastViewed(prev: DateTime | null) {
  vi.mocked(CoachingSessionViewApi.markViewed).mockResolvedValue({
    previousLastViewedAt: prev ? Some(prev) : None,
    lastViewedAt: DateTime.fromISO("2026-06-07T12:00:00.000Z"),
  });
}

const at = (iso: string) => DateTime.fromISO(iso, { zone: "utc" });

function renderPanel() {
  return render(
    <CoachingSessionPanel
      coachingSessionId="session-1"
      coachingRelationshipId="rel-1"
      noteSelection={None}
    />
  );
}

describe("CoachingSessionPanel — provenance wiring (CoachingSessionViews)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = "coachee-1";
    setLastViewed(null); // default: never viewed
    setTopics([]);
  });

  it("marks the session viewed exactly once on open", async () => {
    renderPanel();
    await waitFor(() =>
      expect(CoachingSessionViewApi.markViewed).toHaveBeenCalledWith("session-1")
    );
    expect(CoachingSessionViewApi.markViewed).toHaveBeenCalledTimes(1);
  });

  it("shows the 'new' dot for the OTHER party's topic created after the last-viewed marker", async () => {
    setLastViewed(at("2026-05-31T17:00:00.000Z"));
    setTopics([
      topic({
        id: "t1",
        user_id: "coach-1", // not the viewer (coachee-1)
        body: "Discuss the promotion path",
        created_at: at("2026-06-03T09:00:00.000Z"),
      }),
    ]);
    renderPanel();
    expect(
      (await screen.findAllByText(/new since your last visit/i)).length
    ).toBeGreaterThan(0);
  });

  it("does NOT show the 'new' dot for the viewer's own topic", async () => {
    setLastViewed(at("2026-05-31T17:00:00.000Z"));
    setTopics([
      topic({
        id: "t1",
        user_id: "coachee-1", // the viewer
        body: "My own topic",
        created_at: at("2026-06-03T09:00:00.000Z"),
      }),
    ]);
    renderPanel();
    await screen.findAllByText("My own topic");
    await waitFor(() => expect(CoachingSessionViewApi.markViewed).toHaveBeenCalled());
    expect(screen.queryByText(/new since your last visit/i)).not.toBeInTheDocument();
  });

  it("shows the 'new' dot for the OTHER party's topic on a never-viewed session (null marker)", async () => {
    // Never viewed → the viewer has seen nothing here, so the other party's
    // topic is new even though it predates this first open.
    setLastViewed(null);
    setTopics([
      topic({
        id: "t1",
        user_id: "coach-1",
        body: "Discuss the promotion path",
        created_at: at("2026-06-03T09:00:00.000Z"),
      }),
    ]);
    renderPanel();
    expect(
      (await screen.findAllByText(/new since your last visit/i)).length
    ).toBeGreaterThan(0);
  });

  it("resolves the author's name: a coach-authored topic renders the coach's initials", () => {
    setTopics([topic({ id: "t1", user_id: "coach-1", body: "Reorg" })]);
    renderPanel();
    expect(screen.getAllByText("JH").length).toBeGreaterThan(0);
    expect(screen.queryByText("CB")).not.toBeInTheDocument();
  });

  it("resolves the author's name: a coachee-authored topic renders the coachee's initials", () => {
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();
    expect(screen.getAllByText("CB").length).toBeGreaterThan(0);
    expect(screen.queryByText("JH")).not.toBeInTheDocument();
  });
});
