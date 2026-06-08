// Phase 4 — rating-chip WIRING test (non-frozen, has teeth).
//
// The frozen `topic-rating-chip.test.tsx` pins the presentational chip
// (labels, popover, toggle-to-clear, coachee-only). This test proves the
// *panel host* wiring: it computes `canRate = userId === coacheeId` and routes
// a chip change to the Phase 1 `update` mutation with the exact `{ relevance }`
// / `{ immediacy }` enum payload. With a coach viewer the chips are read-only —
// no chooser is offered and `update` is never called for a rating.
//
// It fails if the coachee/coach gate is wrong, if a non-coachee can rate, or if
// the enum payload sent to `update` is wrong.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel";
import {
  defaultCoachingSessionTopic,
  TopicImmediacy,
  TopicRelevance,
} from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { None } from "@/types/option";

// Desktop viewport so the desktop layout renders (the mobile sheet is closed).
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

const mockRefreshTopics = vi.fn();
const mockUpdateTopic = vi.fn();
const mockRateTopic = vi.fn();

vi.mock("@/lib/api/coaching-session-topics", () => ({
  useCoachingSessionTopicList: vi.fn(),
  useCoachingSessionTopicMutation: vi.fn(() => ({
    create: vi.fn(),
    update: mockUpdateTopic,
    delete: vi.fn(),
    reorder: vi.fn(),
    rate: mockRateTopic,
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

// userId is flipped per-test to simulate a coachee vs a coach viewer.
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
    currentCoachingSession: { id: "session-1", date: "2026-03-28T10:00:00.000Z", coaching_relationship_id: "rel-1" },
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

const topic = (over: Partial<CoachingSessionTopic>): CoachingSessionTopic => ({
  ...defaultCoachingSessionTopic(),
  ...over,
});

function setTopics(topics: CoachingSessionTopic[]) {
  vi.mocked(useCoachingSessionTopicList).mockReturnValue({
    topics,
    isLoading: false,
    isError: false,
    refresh: mockRefreshTopics,
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

// In the desktop layout the relevance chip's collapsed trigger is the first
// match; pick it explicitly to avoid the (closed) mobile layout's duplicate.
function firstChip(name: RegExp) {
  return screen.getAllByRole("button", { name })[0];
}

describe("CoachingSessionPanel — rating wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = "coachee-1";
  });

  it("routes a coachee's relevance pick to update with the exact enum payload", async () => {
    const user = userEvent.setup();
    mockUserId = "coachee-1";
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();

    await user.click(firstChip(/relevance: unrated/i));
    const central = screen.getByRole("button", { name: "Central" });
    await user.click(central);

    await waitFor(() => {
      expect(mockRateTopic).toHaveBeenCalledWith("t1", {
        relevance: TopicRelevance.Central,
      });
    });
  });

  it("routes a coachee's immediacy pick to update with the exact enum payload", async () => {
    const user = userEvent.setup();
    mockUserId = "coachee-1";
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();

    await user.click(firstChip(/immediacy: unrated/i));
    const soon = screen.getByRole("button", { name: "Soon" });
    await user.click(soon);

    await waitFor(() => {
      expect(mockRateTopic).toHaveBeenCalledWith("t1", {
        immediacy: TopicImmediacy.Soon,
      });
    });
  });

  it("clears to Neutral when the coachee re-picks the selected level", async () => {
    const user = userEvent.setup();
    mockUserId = "coachee-1";
    setTopics([
      topic({ id: "t1", user_id: "coachee-1", body: "Reorg", relevance: TopicRelevance.Central }),
    ]);
    renderPanel();

    await user.click(firstChip(/relevance: central/i));
    const central = screen.getByRole("button", { name: "Central" });
    await user.click(central);

    await waitFor(() => {
      expect(mockRateTopic).toHaveBeenCalledWith("t1", {
        relevance: TopicRelevance.Neutral,
      });
    });
  });

  it("renders read-only chips for a coach: no chooser, no rating update", async () => {
    const user = userEvent.setup();
    mockUserId = "coach-1";
    setTopics([
      topic({ id: "t1", user_id: "coachee-1", body: "Reorg", immediacy: TopicImmediacy.Soon }),
    ]);
    renderPanel();

    await user.click(firstChip(/immediacy: soon/i));

    // Read-only popover: a "set by the coachee" hint and no clickable level.
    expect(screen.getByText(/set by the coachee/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Soon" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pressing" })).not.toBeInTheDocument();
    expect(mockRateTopic).not.toHaveBeenCalled();
  });
});
