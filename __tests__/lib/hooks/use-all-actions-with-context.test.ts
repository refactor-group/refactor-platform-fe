import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import {
  CoachViewMode,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { EnrichedCoachingSession } from "@/lib/api/coaching-sessions";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefreshActions = vi.fn();
const mockRefreshCoacheeActions = vi.fn();

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      userSession: { id: "user-1" },
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
      {
        id: "rel-1",
        coach_id: "user-1",
        coachee_id: "coachee-1",
        organization_id: "org-1",
        coach_first_name: "Alice",
        coach_last_name: "Smith",
        coachee_first_name: "Bob",
        coachee_last_name: "Jones",
        created_at: DateTime.now(),
        updated_at: DateTime.now(),
      },
    ],
    isLoading: false,
  }),
}));

// Actions returned by useUserActionsList
let mockMyActions: Action[] = [];
let mockMyActionsLoading = false;
let mockMyActionsError = false;

vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: (userId: string | null) => ({
    actions: userId ? mockMyActions : [],
    isLoading: mockMyActionsLoading,
    isError: mockMyActionsError,
    refresh: mockRefreshActions,
  }),
  UserActionsApi: {
    list: vi.fn().mockResolvedValue([]),
  },
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
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: now.plus({ days: 7 }),
    created_at: now,
    updated_at: now,
    assignee_ids: ["user-1"],
    ...overrides,
  };
}

function makeTestSession(
  overrides: Partial<EnrichedCoachingSession> = {}
): EnrichedCoachingSession {
  return {
    id: "session-1",
    coaching_relationship_id: "rel-1",
    date: now.plus({ days: 1 }).toISO()!,
    created_at: now,
    updated_at: now,
    relationship: {
      id: "rel-1",
      coach_id: "user-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      created_at: now,
      updated_at: now,
    },
    coach: {
      id: "user-1",
      first_name: "Alice",
      last_name: "Smith",
    },
    coachee: {
      id: "coachee-1",
      first_name: "Bob",
      last_name: "Jones",
    },
    overarching_goal: {
      id: "goal-1",
      title: "Test Goal",
    },
    ...overrides,
  } as EnrichedCoachingSession;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAllActionsWithContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMyActions = [];
    mockMyActionsLoading = false;
    mockMyActionsError = false;
    mockSessions = [];
    mockSessionsLoading = false;
    mockSessionsError = false;
  });

  it("returns enriched actions with relationship context", () => {
    mockMyActions = [makeTestAction()];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(1);
    const ctx = result.current.actionsWithContext[0];
    expect(ctx.relationship.coachName).toBe("Alice Smith");
    expect(ctx.relationship.coacheeName).toBe("Bob Jones");
    expect(ctx.relationship.coachId).toBe("user-1");
    expect(ctx.relationship.coacheeId).toBe("coachee-1");
  });

  it("returns empty array when there are no actions", () => {
    mockMyActions = [];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("excludes orphaned actions with no matching session", () => {
    mockMyActions = [makeTestAction({ coaching_session_id: "nonexistent" })];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(0);
  });

  it("isLoading is true while actions are loading", () => {
    mockMyActionsLoading = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("isLoading is true while sessions are loading", () => {
    mockSessionsLoading = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("isError is true when actions fetch fails", () => {
    mockMyActionsError = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.isError).toBeTruthy();
  });

  it("isError is true when sessions fetch fails", () => {
    mockSessionsError = true;

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.isError).toBeTruthy();
  });

  it("enriches actions from multiple relationships", () => {
    const session2 = makeTestSession({
      id: "session-2",
      coaching_relationship_id: "rel-2",
      relationship: {
        id: "rel-2",
        coach_id: "user-1",
        coachee_id: "coachee-2",
        organization_id: "org-1",
        created_at: now,
        updated_at: now,
      } as EnrichedCoachingSession["relationship"],
      coach: { id: "user-1", first_name: "Alice", last_name: "Smith" },
      coachee: { id: "coachee-2", first_name: "Charlie", last_name: "Brown" },
    });
    mockMyActions = [
      makeTestAction({ id: "a1", coaching_session_id: "session-1" }),
      makeTestAction({ id: "a2", coaching_session_id: "session-2" }),
    ];
    mockSessions = [makeTestSession(), session2];

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(2);
    const names = result.current.actionsWithContext.map(
      (a) => a.relationship.coacheeName
    );
    expect(names).toContain("Bob Jones");
    expect(names).toContain("Charlie Brown");
  });

  it("sets isOverdue when due_by is in the past", () => {
    mockMyActions = [
      makeTestAction({ due_by: now.minus({ days: 5 }) }),
    ];
    mockSessions = [makeTestSession()];

    const { result } = renderHook(() =>
      useAllActionsWithContext(CoachViewMode.MyActions)
    );

    expect(result.current.actionsWithContext).toHaveLength(1);
    expect(result.current.actionsWithContext[0].isOverdue).toBe(true);
  });
});
