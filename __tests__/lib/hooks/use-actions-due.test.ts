import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { DateTime, Settings } from "ts-luxon";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { UserActionsScope } from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import { ActionsDueKind, actionsDueAt } from "@/lib/actions-due";
import { useActionsDue } from "@/lib/hooks/use-actions-due";

const TZ = "America/Chicago";
const REL = "rel-1";
const VIEWER = "user-1";

let mockActions: Action[] = [];
let mockSessions: CoachingSession[] = [];
const mockUseUserActionsList = vi.fn();
const mockUseCoachingSessionList = vi.fn();

vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: (...args: unknown[]) => {
    mockUseUserActionsList(...args);
    return { actions: mockActions, isLoading: false, isError: undefined, refresh: vi.fn() };
  },
}));

vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: (...args: unknown[]) => {
    mockUseCoachingSessionList(...args);
    return { coachingSessions: mockSessions, isLoading: false, isError: undefined, refresh: vi.fn() };
  },
}));

vi.mock("@/lib/hooks/use-user-timezone", () => ({ useUserTimezone: () => TZ }));

const pinnedNow = DateTime.fromISO("2026-11-19T18:00:00Z");

function makeSession(id: string, isoDate: string): CoachingSession {
  return {
    id,
    coaching_relationship_id: REL,
    date: isoDate,
    created_at: pinnedNow,
    updated_at: pinnedNow,
  } as CoachingSession;
}

function makeAction(id: string, sessionId: string, status: ItemStatus, dueIso: string): Action {
  return {
    id,
    coaching_session_id: sessionId,
    goal_id: None,
    body: "An action",
    user_id: VIEWER,
    status,
    status_changed_at: pinnedNow,
    due_by: Some(DateTime.fromISO(dueIso)),
    created_at: pinnedNow,
    updated_at: pinnedNow,
    assignee_ids: [],
  };
}

const prior = makeSession("s-prev", "2026-11-12T15:00:00Z");
const next = makeSession("s-next", "2026-11-26T15:00:00Z");

describe("useActionsDue", () => {
  const originalNow = Settings.now;

  beforeEach(() => {
    Settings.now = () => pinnedNow.toMillis();
    mockUseUserActionsList.mockClear();
    mockUseCoachingSessionList.mockClear();
    mockSessions = [prior, next];
    mockActions = [
      makeAction("a-overdue", "s-prev", ItemStatus.NotStarted, "2026-11-15T12:00:00Z"),
      makeAction("a-upcoming", "s-prev", ItemStatus.InProgress, "2026-11-24T12:00:00Z"),
      makeAction("a-new", "s-next", ItemStatus.NotStarted, "2026-11-20T12:00:00Z"),
    ];
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it("fetches actions with the panel's relationship-scoped key", () => {
    renderHook(() => useActionsDue(next, VIEWER, pinnedNow));
    expect(mockUseUserActionsList).toHaveBeenCalledWith(VIEWER, {
      scope: UserActionsScope.Sessions,
      coaching_relationship_id: REL,
    });
  });

  it("fetches sessions over the panel's 5-year back, 1-year ahead window", () => {
    renderHook(() => useActionsDue(next, VIEWER, pinnedNow));
    expect(mockUseCoachingSessionList).toHaveBeenCalledWith(
      REL,
      expect.any(DateTime),
      expect.any(DateTime),
      "date",
      "asc"
    );
    const [, from, to] = mockUseCoachingSessionList.mock.calls[0] as [string, DateTime, DateTime];
    expect(from.toISODate()).toBe(pinnedNow.minus({ years: 5 }).toISODate());
    expect(to.toISODate()).toBe(pinnedNow.plus({ years: 1 }).toISODate());
  });

  it("returns the due set, previous session and summary", () => {
    const { result } = renderHook(() => useActionsDue(next, VIEWER, pinnedNow));
    expect(result.current.due).toEqual(actionsDueAt(mockActions, mockSessions, next.id, TZ));
    expect(result.current.previous).toEqual(Some(prior));
    expect(result.current.summary).toEqual({
      kind: ActionsDueKind.Overdue,
      count: 2,
      overdue: 1,
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
