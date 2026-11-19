import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { DateTime, Settings } from "ts-luxon";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { noName } from "@/types/membership";
import type { Action } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import { useActionsDue } from "@/lib/hooks/use-actions-due";
import { usePanelActions } from "@/lib/hooks/use-panel-actions";

// Manual case 5.4: the card's Actions due set is the panel's Due tab.

const TZ = "America/Chicago";
const REL = "rel-1";
const VIEWER = "user-1";
const pinnedNow = DateTime.fromISO("2026-11-19T14:00:00Z");

let mockActions: Action[] = [];
let mockSessions: CoachingSession[] = [];

vi.mock("@/lib/api/user-actions", () => ({
  useUserActionsList: () => ({ actions: mockActions, isLoading: false, isError: undefined, refresh: vi.fn() }),
}));

vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: () => ({
    coachingSessions: mockSessions,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/use-user-timezone", () => ({ useUserTimezone: () => TZ }));

vi.mock("@/lib/api/actions", () => ({
  useActionMutation: () => ({
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>();
  return { ...actual, useSWRConfig: () => ({ mutate: vi.fn() }) };
});

function makeSession(id: string, date: string): CoachingSession {
  return {
    id,
    coaching_relationship_id: REL,
    date,
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

const LAST_WEEK = makeSession("s-last-week", "2026-11-12T15:00:00");
const MORNING = makeSession("s-morning", "2026-11-19T09:00:00");
const TARGET = makeSession("s-target", "2026-11-19T15:00:00");
const SESSIONS = [LAST_WEEK, MORNING, TARGET];

const ACTIONS = [
  makeAction("a-before-last-week", LAST_WEEK.id, ItemStatus.NotStarted, "2026-11-10T18:00:00Z"),
  makeAction("a-last-week-open", LAST_WEEK.id, ItemStatus.NotStarted, "2026-11-16T18:00:00Z"),
  makeAction("a-last-week-done", LAST_WEEK.id, ItemStatus.Completed, "2026-11-17T18:00:00Z"),
  // Between the morning session and the target, on the same day.
  makeAction("a-between", MORNING.id, ItemStatus.InProgress, "2026-11-19T12:00:00Z"),
  makeAction("a-created-in-target", TARGET.id, ItemStatus.NotStarted, "2026-11-19T13:00:00Z"),
  makeAction("a-after", MORNING.id, ItemStatus.NotStarted, "2026-11-24T18:00:00Z"),
];

const ids = (actions: Action[]) => actions.map((a) => a.id).sort();

function cardDue() {
  return renderHook(() => useActionsDue(TARGET, VIEWER, pinnedNow.setZone(TZ))).result.current;
}

function panelDue() {
  return renderHook(() =>
    usePanelActions({
      userId: VIEWER,
      coachingSessionId: TARGET.id,
      coachingRelationshipId: REL,
      sessionDate: TARGET.date,
      nameOf: noName,
    })
  ).result.current.reviewActions;
}

describe("Actions due parity between the card and the Due tab", () => {
  const originalNow = Settings.now;

  beforeEach(() => {
    Settings.now = () => pinnedNow.toMillis();
    mockActions = ACTIONS;
    mockSessions = SESSIONS;
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it("returns the same actions for the same target session", () => {
    const card = cardDue();
    const panel = panelDue();
    expect(ids(card.due)).toEqual(ids(panel));
    expect(ids(card.due)).toEqual(["a-between"]);
  });

  it("takes the same-day morning session as the previous one", () => {
    expect(cardDue().previous).toEqual(Some(MORNING));
  });
});
