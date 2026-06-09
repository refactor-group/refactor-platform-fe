// Panel-host WIRING test (non-frozen, has teeth) for the v4 topic controls.
//
// Proves the panel routes:
//  - a coachee's PRIORITY pick to `rate` with the exact `{ priority }` payload,
//    and a clear to `{ priority: null }`. Priority is coachee-only — a coach's
//    priority control is disabled.
//  - a STATUS toggle (Discussed/Defer) to `setStatus`, for EITHER participant
//    (here proven with a coach viewer, who may set status but not priority).

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel";
import {
  defaultCoachingSessionTopic,
  TopicPriority,
  TopicStatus,
} from "@/types/coaching-session-topic";
import type { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { Some, None } from "@/types/option";

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
const mockRateTopic = vi.fn();
const mockSetStatus = vi.fn();

vi.mock("@/lib/api/coaching-session-topics", () => ({
  useCoachingSessionTopicList: vi.fn(),
  useCoachingSessionTopicMutation: vi.fn(() => ({
    create: vi.fn(),
    restore: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
    rate: mockRateTopic,
    setStatus: mockSetStatus,
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

// The desktop + (closed) mobile layouts each mount a control; pick the first.
const firstByRole = (role: string, name: RegExp) =>
  screen.getAllByRole(role, { name })[0];

describe("CoachingSessionPanel — priority wiring (coachee-only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserId = "coachee-1";
  });

  it("routes a coachee's priority pick to rate with the exact payload", async () => {
    const user = userEvent.setup();
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();

    await user.click(firstByRole("combobox", /priority/i));
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("High"));

    await waitFor(() => {
      expect(mockRateTopic).toHaveBeenCalledWith("t1", {
        priority: TopicPriority.High,
      });
    });
  });

  it("routes a clear to rate with priority: null", async () => {
    const user = userEvent.setup();
    setTopics([
      topic({ id: "t1", user_id: "coachee-1", body: "Reorg", priority: Some(TopicPriority.High) }),
    ]);
    renderPanel();

    await user.click(firstByRole("combobox", /priority/i));
    const listbox = screen.getByRole("listbox");
    await user.click(within(listbox).getByText("Clear"));

    await waitFor(() => {
      expect(mockRateTopic).toHaveBeenCalledWith("t1", { priority: null });
    });
  });

  it("disables the priority control for a coach viewer", () => {
    mockUserId = "coach-1";
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();
    expect(firstByRole("combobox", /priority/i)).toBeDisabled();
  });
});

describe("CoachingSessionPanel — status wiring (either participant)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a coach's Discussed toggle to setStatus", async () => {
    const user = userEvent.setup();
    mockUserId = "coach-1";
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();

    await user.click(firstByRole("button", /mark as discussed/i));

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith("t1", TopicStatus.Discussed);
    });
  });

  it("routes a Defer toggle to setStatus", async () => {
    const user = userEvent.setup();
    mockUserId = "coachee-1";
    setTopics([topic({ id: "t1", user_id: "coachee-1", body: "Reorg" })]);
    renderPanel();

    await user.click(firstByRole("button", /defer to next session/i));

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith("t1", TopicStatus.Deferred);
    });
  });
});
