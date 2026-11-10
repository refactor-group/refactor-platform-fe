import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Settings } from "ts-luxon";
import { useRouter } from "next/navigation";
import { NewSessionDialog } from "@/components/ui/new-session/new-session-dialog";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  CoachingSessionApi,
  useEnrichedCoachingSessionsForUser,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi, useCoachingSessionSeries } from "@/lib/api/coaching-session-series";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { busySessions, pickerPeople } from "@/lib/schedule-draft";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { createMockSession } from "../../../test-utils";
import { ALL, E_04, E_11, E_18, NEAREST, NOW, RELATIONSHIPS, session } from "../../../lib/scheduling/roster";

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userId: "me", isACoach: true, userSession: { id: "me", timezone: "America/Chicago" } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/api/coaching-relationships", () => ({ useCoachingRelationshipList: vi.fn() }));
vi.mock("@/lib/api/oauth-connection", () => ({ useOAuthConnections: vi.fn() }));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  useUser: () => ({
    user: { id: "me", default_coaching_session_duration_minutes: 50 },
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-sessions")>();
  return {
    ...actual,
    useNearestEachCoachingSessions: vi.fn(),
    useEnrichedCoachingSessionsForUser: vi.fn(),
    CoachingSessionApi: { ...actual.CoachingSessionApi, create: vi.fn(), update: vi.fn(), move: vi.fn() },
  };
});
vi.mock("@/lib/api/coaching-session-series", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-session-series")>();
  return {
    ...actual,
    useCoachingSessionSeries: vi.fn(),
    CoachingSessionSeriesApi: { ...actual.CoachingSessionSeriesApi, create: vi.fn(), reschedule: vi.fn() },
  };
});
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/schedule-draft", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/schedule-draft")>();
  return {
    ...actual,
    pickerPeople: vi.fn(actual.pickerPeople),
    busySessions: vi.fn(actual.busySessions),
  };
});

const create = vi.mocked(CoachingSessionApi.create);
const move = vi.mocked(CoachingSessionApi.move);
const reschedule = vi.mocked(CoachingSessionSeriesApi.reschedule);

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };
const E_25 = session({ id: "e-25", relationshipId: "rel-e", person: EHAB, start: "2026-08-25T14:30", series: "series-e" });
const E_01 = session({ id: "e-01", relationshipId: "rel-e", person: EHAB, start: "2026-09-01T14:30", series: "series-e" });

const SERIES = {
  id: "series-e",
  coaching_relationship_id: "rel-e",
  rule: {
    start_at: E_04.date,
    duration_minutes: 50,
    recurrence: { frequency: Frequency.Weekly, interval: 1, by_weekdays: [Weekday.Tue], count: Some(5), until: None },
  },
  created_by_user_id: "me",
  created_at: NOW,
  updated_at: NOW,
  coaching_sessions: [E_04, E_11, E_18, E_25, E_01],
};

function serveRelationships(relationships: CoachingRelationshipWithUserNames[]) {
  vi.mocked(useCoachingRelationshipList).mockReturnValue({
    relationships,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingRelationshipList>);
}

function serveSessions(sessions: EnrichedCoachingSession[]) {
  vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
    enrichedSessions: sessions,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useEnrichedCoachingSessionsForUser>);
}

const originalNow = Settings.now;

beforeEach(() => {
  vi.clearAllMocks();
  Settings.now = () => NOW.toMillis();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn() } as unknown as ReturnType<typeof useRouter>);
  serveRelationships(RELATIONSHIPS);
  vi.mocked(useNearestEachCoachingSessions).mockReturnValue({ sessions: NEAREST, isLoading: false, isError: undefined });
  serveSessions(ALL);
  vi.mocked(useOAuthConnections).mockReturnValue({
    connections: [{ provider: "google" }],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useOAuthConnections>);
  vi.mocked(useCoachingSessionSeries).mockReturnValue({
    series: SERIES,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingSessionSeries>);
  create.mockResolvedValue(createMockSession({ id: "new" }));
  move.mockResolvedValue(createMockSession({ id: "p-18" }));
  reschedule.mockResolvedValue(SERIES as unknown as Awaited<ReturnType<typeof CoachingSessionSeriesApi.reschedule>>);
});

afterEach(() => {
  Settings.now = originalNow;
  vi.unstubAllGlobals();
});

function renderSchedule() {
  render(<NewSessionDialog request={{ kind: "schedule", date: None }} onClose={vi.fn()} />);
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
const person = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });

const rebuilds = () => ({
  people: vi.mocked(pickerPeople).mock.calls.length,
  busy: vi.mocked(busySessions).mock.calls.length,
});

describe("Derived schedule data is built once per data change", () => {
  it("doesn't rebuild the Who list or busy sessions while typing, picking and stepping", () => {
    renderSchedule();
    const settled = rebuilds();
    expect(settled.people).toBeGreaterThan(0);

    const search = screen.getByPlaceholderText("Find a person");
    for (const text of ["P", "Pr", "Pri", ""]) fireEvent.change(search, { target: { value: text } });
    fireEvent.click(person("Priya Raman"));
    next();
    typeTime("09:00");
    typeTime("09:30");

    expect(rebuilds()).toEqual(settled);
  });

  it("still rebuilds busy sessions when the shown month changes", () => {
    // Like SWR: one stable array per requested window.
    const byWindow = new Map<string, EnrichedCoachingSession[]>();
    vi.mocked(useEnrichedCoachingSessionsForUser).mockImplementation(((_user: unknown, from: { toISODate(): string }, to: { toISODate(): string }) => {
      const key = `${from.toISODate()}..${to.toISODate()}`;
      if (!byWindow.has(key)) byWindow.set(key, [...ALL]);
      return { enrichedSessions: byWindow.get(key)!, isLoading: false, isError: undefined, refresh: vi.fn() };
    }) as unknown as typeof useEnrichedCoachingSessionsForUser);
    renderSchedule();
    fireEvent.click(person("Priya Raman"));
    next();
    const before = rebuilds();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(rebuilds().busy).toBeGreaterThan(before.busy);
  });
});
