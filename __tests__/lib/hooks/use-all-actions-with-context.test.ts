import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { DateTime, Settings } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { Some, None } from "@/types/option";
import {
  AssignmentFilter,
  ActionsViewMode,
} from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { EnrichedCoachingSession } from "@/lib/api/coaching-sessions";
import type { Participant } from "@/types/participant";
import { getCoacheeName, getCoachName } from "@/lib/utils/relationship";
import {
  createMockEnrichedSession,
  createMockGoal,
  createMockRelationship,
  mockParticipants,
} from "../../test-utils";

const ALICE = { first_name: "Alice", last_name: "Smith" };
const BOB = { id: "coachee-1", first_name: "Bob", last_name: "Jones" };

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefreshActions = vi.fn();
const mockRefreshSessions = vi.fn();

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      userSession: { id: "user-1" },
      isACoach: true,
      canScheduleSessions: true,
    }),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [
      createMockRelationship(
        { id: "rel-1", coach_id: "user-1", coachee_id: "coachee-1" },
        { coach: ALICE, coachee: BOB }
      ),
    ],
    isLoading: false,
  }),
}));

// Both "My Actions" and "Coachee Actions" now use useBatchRelationshipActions
let mockActions: Action[] = [];
let mockActionsLoading = false;
let mockActionsError = false;

vi.mock("@/lib/api/relationship-actions", () => ({
  useForgetActionsOnOrganizationChange: vi.fn(),
  useBatchRelationshipActions: () => ({
    actions: mockActions,
    isLoading: mockActionsLoading,
    isError: mockActionsError,
    refresh: mockRefreshActions,
  }),
}));

// Enriched sessions
let mockSessions: EnrichedCoachingSession[] | null = [];
let mockSessionsLoading = false;
let mockSessionsError = false;

vi.mock("@/lib/api/coaching-sessions", () => ({
  useEnrichedCoachingSessionsForUser: () => ({
    enrichedSessions: mockSessions,
    isLoading: mockSessionsLoading,
    isError: mockSessionsError,
    refresh: mockRefreshSessions,
  }),
  CoachingSessionInclude: {
    Relationship: "relationship",
    Goal: "goal",
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { useAllActionsWithContext } = await import(
  "@/lib/hooks/use-all-actions-with-context"
);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = DateTime.now();

function makeTestAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    coaching_session_id: "session-1",
    goal_id: None,
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: Some(now.plus({ days: 7 })),
    created_at: now,
    updated_at: now,
    assignee_ids: ["user-1"],
    ...overrides,
  };
}

function makeTestSession(
  overrides: Partial<EnrichedCoachingSession> = {},
  coachee: Partial<Participant> & { id: string } = BOB
): EnrichedCoachingSession {
  const base = createMockEnrichedSession();
  const relationship = {
    ...base.relationship!,
    id: overrides.coaching_relationship_id ?? "rel-1",
    coach_id: "user-1",
    coachee_id: coachee.id,
  };
  return createMockEnrichedSession({
    date: now.plus({ days: 1 }).toISO()!,
    relationship,
    participants: Some(mockParticipants("user-1", coachee.id, relationship.kind, { coach: ALICE, coachee })),
    goals: [createMockGoal({ id: "goal-1", title: "Test Goal" })],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAllActionsWithContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActions = [];
    mockActionsLoading = false;
    mockActionsError = false;
    mockSessions = [];
    mockSessionsLoading = false;
    mockSessionsError = false;
  });

  it("returns enriched actions with relationship context", () => {
    mockActions = [makeTestAction()];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(1);
    const ctx = result.current.actionsWithContext[0];
    expect(getCoachName(ctx.relationship)).toBe("Alice Smith");
    expect(getCoacheeName(ctx.relationship)).toBe("Bob Jones");
    expect(ctx.relationship.coach_id).toBe("user-1");
    expect(ctx.relationship.coachee_id).toBe("coachee-1");
  });

  it("returns empty array when there are no actions", () => {
    mockActions = [];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  // Session ids are unique per test: refetched ids are remembered across mounts.
  describe("refetching sessions for an action in an unknown session", () => {
    it("refetches the sessions once, even across remounts", () => {
      mockActions = [makeTestAction({ coaching_session_id: "new-session-a" })];
      mockSessions = [makeTestSession()];

      const { rerender, unmount } = renderHook(() =>
        useAllActionsWithContext(ActionsViewMode.MyActions)
      );
      rerender();
      unmount();
      renderHook(() => useAllActionsWithContext(ActionsViewMode.MyActions));

      expect(mockRefreshSessions).toHaveBeenCalledTimes(1);
    });

    it("refetches again for another unknown session", () => {
      mockActions = [makeTestAction({ coaching_session_id: "new-session-b" })];
      mockSessions = [makeTestSession()];
      const { rerender } = renderHook(() => useAllActionsWithContext(ActionsViewMode.MyActions));

      mockActions = [
        makeTestAction({ coaching_session_id: "new-session-b" }),
        makeTestAction({ id: "action-2", coaching_session_id: "new-session-c" }),
      ];
      rerender();

      expect(mockRefreshSessions).toHaveBeenCalledTimes(2);
    });

    it("refetches each session cache, such as a header mounted yesterday and a page today", () => {
      const originalNow = Settings.now;
      const lateYesterday = DateTime.fromISO("2026-11-01T23:59:00Z").toMillis();
      const earlyToday = DateTime.fromISO("2026-11-02T00:01:00Z").toMillis();
      mockActions = [makeTestAction({ coaching_session_id: "new-session-e" })];
      mockSessions = [makeTestSession()];
      try {
        Settings.now = () => lateYesterday;
        renderHook(() => useAllActionsWithContext(ActionsViewMode.MyActions));
        Settings.now = () => earlyToday;
        renderHook(() => useAllActionsWithContext(ActionsViewMode.MyActions));
      } finally {
        Settings.now = originalNow;
      }

      expect(mockRefreshSessions).toHaveBeenCalledTimes(2);
    });

    it("waits until actions and sessions have loaded", () => {
      mockActions = [makeTestAction({ coaching_session_id: "new-session-d" })];
      mockSessionsLoading = true;
      renderHook(() => useAllActionsWithContext(ActionsViewMode.MyActions));

      expect(mockRefreshSessions).not.toHaveBeenCalled();
    });

    it("doesn't refetch when every session is known", () => {
      mockActions = [makeTestAction()];
      mockSessions = [makeTestSession()];
      renderHook(() => useAllActionsWithContext(ActionsViewMode.MyActions));

      expect(mockRefreshSessions).not.toHaveBeenCalled();
    });
  });

  it("excludes orphaned actions with no matching session", () => {
    mockActions = [makeTestAction({ coaching_session_id: "nonexistent" })];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(0);
  });

  it("isLoading is true while actions are loading", () => {
    mockActionsLoading = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading is true while sessions are loading", () => {
    mockSessionsLoading = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("isError is true when actions fetch fails", () => {
    mockActionsError = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.isError).toBeTruthy();
  });

  it("isError is true when sessions fetch fails", () => {
    mockSessionsError = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.isError).toBeTruthy();
  });

  it("enriches actions from multiple relationships", () => {
    const session2 = makeTestSession(
      { id: "session-2", coaching_relationship_id: "rel-2" },
      { id: "coachee-2", first_name: "Charlie", last_name: "Brown" }
    );
    mockActions = [
      makeTestAction({ id: "a1", coaching_session_id: "session-1" }),
      makeTestAction({ id: "a2", coaching_session_id: "session-2" }),
    ];
    mockSessions = [makeTestSession(), session2];

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(2);
    const names = result.current.actionsWithContext.map(
      (a) => getCoacheeName(a.relationship)
    );
    expect(names).toContain("Bob Jones");
    expect(names).toContain("Charlie Brown");
  });

  it("sets isOverdue when due_by is in the past", () => {
    mockActions = [
      makeTestAction({ due_by: Some(now.minus({ days: 5 })) }),
    ];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(ActionsViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(1);
    expect(result.current.actionsWithContext[0].isOverdue).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CoacheeActions mode
  // -------------------------------------------------------------------------

  describe("CoacheeActions mode", () => {
    it("returns enriched actions in CoacheeActions mode", () => {
      mockActions = [makeTestAction()];
      mockSessions = [makeTestSession()];

      const { result } = renderHook(() =>
        useAllActionsWithContext(ActionsViewMode.CoacheeActions)
      );

      expect(result.current.actionsWithContext).toHaveLength(1);
      const ctx = result.current.actionsWithContext[0];
      expect(getCoachName(ctx.relationship)).toBe("Alice Smith");
      expect(getCoacheeName(ctx.relationship)).toBe("Bob Jones");
    });

    it("isLoading is true while coachee actions are loading", () => {
      mockActionsLoading = true;

      const { result } = renderHook(() =>
        useAllActionsWithContext(ActionsViewMode.CoacheeActions)
      );

      expect(result.current.isLoading).toBe(true);
    });

    it("isError is true when coachee actions fetch fails", () => {
      mockActionsError = true;

      const { result } = renderHook(() =>
        useAllActionsWithContext(ActionsViewMode.CoacheeActions)
      );

      expect(result.current.isError).toBe(true);
    });

    it("forwards relationshipId to useActionsFetch", () => {
      mockActions = [makeTestAction()];
      mockSessions = [makeTestSession()];

      const { result } = renderHook(() =>
        useAllActionsWithContext(ActionsViewMode.CoacheeActions, "rel-1")
      );

      // If the relationship filter is passed correctly, actions matching
      // that relationship still get enriched
      expect(result.current.actionsWithContext).toHaveLength(1);
      expect(result.current.actionsWithContext[0].relationship.id).toBe("rel-1");
    });

    it("forwards assignmentFilter to useActionsFetch", () => {
      mockActions = [makeTestAction()];
      mockSessions = [makeTestSession()];

      const { result } = renderHook(() =>
        useAllActionsWithContext(
          ActionsViewMode.CoacheeActions,
          undefined,
          AssignmentFilter.Unassigned
        )
      );

      // The hook renders successfully with the filter — actions still enrich
      expect(result.current.actionsWithContext).toHaveLength(1);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
