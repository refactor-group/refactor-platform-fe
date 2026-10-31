import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { DateTime, Settings } from "ts-luxon";
import { usePathname } from "next/navigation";
import { useJoinSessionMenu } from "@/lib/hooks/use-join-session-menu";
import {
  type NearestQuery,
  useCoachingSession,
  useNearestCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";
import type { Option } from "@/types/option";
import { Some } from "@/types/option";
import { createMockEnrichedSession, createMockRelationship, createMockSession } from "../../test-utils";

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userId: "me", userSession: { id: "me", timezone: "America/Chicago" } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/api/coaching-relationships", () => ({ useCoachingRelationshipList: vi.fn() }));
vi.mock("@/lib/hooks/use-todays-sessions", () => ({ useTodaysSessions: vi.fn() }));
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useCoachingSession: vi.fn(),
  useNearestCoachingSessions: vi.fn(),
}));

const NOW = DateTime.fromISO("2026-08-25T19:00:00Z", { zone: "utc" });

const rel = (id: string, coacheeId: string, first: string, last: string) =>
  createMockRelationship({
    id,
    coach_id: "me",
    coachee_id: coacheeId,
    coachee_first_name: first,
    coachee_last_name: last,
  });

const RELATIONSHIPS = [
  rel("rel-z", "zed", "Zed", "Adams"),
  rel("rel-p", "priya", "Priya", "Raman"),
  rel("rel-e", "ehab", "Ehab", "Badawi"),
  rel("rel-e2", "ehab", "Ehab", "Badawi"),
];

const PRIYA_TODAY = createMockEnrichedSession({
  id: "priya-today",
  coaching_relationship_id: "rel-p",
  date: "2026-08-25T21:30:00",
  relationship: { ...RELATIONSHIPS[1], coach_id: "me" },
  coachee: { ...createMockEnrichedSession().coachee!, id: "priya", first_name: "Priya", last_name: "Raman" },
});

const EHAB_CURRENT = createMockSession({
  id: "ehab-7",
  coaching_relationship_id: "rel-e",
  date: "2026-08-11T15:00:00",
});

function serveCoachingSession(session: CoachingSession) {
  vi.mocked(useCoachingSession).mockImplementation((id) => ({
    coachingSession: id === session.id ? session : createMockSession({ id: "" }),
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }) as unknown as ReturnType<typeof useCoachingSession>);
}

function lastNearestQuery(): Option<NearestQuery> {
  const calls = vi.mocked(useNearestCoachingSessions).mock.calls;
  return calls[calls.length - 1][0];
}

function lastWindow() {
  const query = lastNearestQuery();
  if (query.none) throw new Error("expected a nearest query");
  const { relationshipId, around, before, after } = query.val;
  return { relationshipId, around, before, after };
}

function renderOpened() {
  const rendered = renderHook(() => useJoinSessionMenu());
  act(() => rendered.result.current.reset());
  return rendered;
}

describe("useJoinSessionMenu", () => {
  const originalNow = Settings.now;

  beforeEach(() => {
    vi.clearAllMocks();
    Settings.now = () => NOW.toMillis();
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: RELATIONSHIPS,
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useCoachingRelationshipList>);
    vi.mocked(useTodaysSessions).mockReturnValue({
      sessions: [PRIYA_TODAY] as EnrichedCoachingSession[],
      isLoading: false,
      error: undefined,
      refresh: vi.fn(),
      _tick: 0,
    } as unknown as ReturnType<typeof useTodaysSessions>);
    serveCoachingSession(EHAB_CURRENT);
    vi.mocked(useNearestCoachingSessions).mockReturnValue({
      sessions: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useNearestCoachingSessions>);
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it("requests no window until the menu first opens", () => {
    const { result } = renderHook(() => useJoinSessionMenu());
    expect(lastNearestQuery().none).toBe(true);
    expect(result.current.sessions.kind).toBe("loading");
    act(() => result.current.reset());
    expect(lastNearestQuery().some).toBe(true);
  });

  it("lists one person per other participant, sorted by name", () => {
    const { result } = renderOpened();
    expect(result.current.people.map((p) => p.firstName)).toEqual(["Ehab", "Priya", "Zed"]);
    expect(result.current.people[0]).toEqual({
      userId: "ehab",
      firstName: "Ehab",
      fullName: "Ehab Badawi",
      initials: "EB",
    });
  });

  it("defaults to the first person off a session page", () => {
    const { result } = renderOpened();
    expect(result.current.selectedId).toEqual(Some("ehab"));
  });

  it("defaults to the current session's person", () => {
    serveCoachingSession(createMockSession({ id: "zed-3", coaching_relationship_id: "rel-z", date: "2026-08-20T15:00:00" }));
    vi.mocked(usePathname).mockReturnValue("/coaching-sessions/zed-3");
    const { result } = renderOpened();
    expect(result.current.selectedId).toEqual(Some("zed"));
    expect(result.current.current).toEqual(Some("zed-3"));
  });

  it("anchors on today's session, verbatim, when the person has one", () => {
    const { result } = renderOpened();
    act(() => result.current.selectPerson("priya"));
    expect(lastWindow()).toEqual({
      relationshipId: "rel-p",
      around: "2026-08-25T21:30:00",
      before: 2,
      after: 3,
    });
  });

  it("anchors on the current session when it belongs to the person", () => {
    vi.mocked(usePathname).mockReturnValue("/coaching-sessions/ehab-7");
    renderOpened();
    expect(lastWindow()).toEqual({
      relationshipId: "rel-e",
      around: "2026-08-11T15:00:00",
      before: 2,
      after: 3,
    });
  });

  it("anchors on now, in UTC with a Z, otherwise", () => {
    vi.mocked(usePathname).mockReturnValue("/coaching-sessions/ehab-7");
    const { result } = renderOpened();
    act(() => result.current.selectPerson("zed"));
    expect(lastWindow()).toEqual({
      relationshipId: "rel-z",
      around: "2026-08-25T19:00:00Z",
      before: 2,
      after: 2,
    });
  });

  it("only treats /coaching-sessions/{id} as a session page", () => {
    vi.mocked(usePathname).mockReturnValue("/organizations/ehab-7/members");
    const { result } = renderOpened();
    expect(result.current.current.none).toBe(true);
    expect(vi.mocked(useCoachingSession)).toHaveBeenLastCalledWith("");
    expect(lastWindow().around).toBe("2026-08-25T19:00:00Z");
  });

  it("puts today's sessions in the Today block with their person", () => {
    const { result } = renderOpened();
    expect(result.current.today).toHaveLength(1);
    expect(result.current.today[0].person.fullName).toBe("Priya Raman");
    expect(result.current.today[0].session.start.toFormat("h:mm a")).toBe("4:30 PM");
  });

  it("returns to the default person on reset", () => {
    const { result } = renderOpened();
    act(() => result.current.selectPerson("zed"));
    expect(result.current.selectedId).toEqual(Some("zed"));
    act(() => result.current.reset());
    expect(result.current.selectedId).toEqual(Some("ehab"));
  });

  it("maps the response into a loaded window", () => {
    vi.mocked(useNearestCoachingSessions).mockReturnValue({
      sessions: [
        createMockEnrichedSession({ id: "next", date: "2026-09-01T15:00:00", display_title: Some("Plan") }),
        createMockEnrichedSession({ id: "prev", date: "2026-08-11T15:00:00", display_title: Some("Kickoff") }),
      ],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useNearestCoachingSessions>);
    const { result } = renderOpened();
    const { sessions } = result.current;
    if (sessions.kind !== "loaded") throw new Error(`expected loaded, got ${sessions.kind}`);
    expect(sessions.list.map((s) => s.title)).toEqual(["Plan", "Kickoff"]);
    expect(sessions.groups.map((g) => g.label)).toEqual(["Aug", "Sep"]);
  });
});
