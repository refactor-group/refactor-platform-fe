import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { MoveScope } from "@/lib/scheduling";
import { toast } from "@/lib/toast";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { createMockSession } from "../../../test-utils";
import { ALL, E_04, E_11, E_18, NEAREST, NOW, P_18, RELATIONSHIPS, session } from "../../../lib/scheduling/roster";

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

function renderMove(target: EnrichedCoachingSession, scope = MoveScope.This) {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "move", session: target, scope }} onClose={onClose} />);
  return onClose;
}

const rail = () => within(screen.getByRole("list", { name: "Steps" }));
const railRow = (label: string) => rail().getAllByRole("listitem").find((row) => row.textContent?.startsWith(label));
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
const person = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });
const focused = () => document.activeElement?.getAttribute("aria-label") ?? "";

function toWhen() {
  renderSchedule();
  fireEvent.click(person("Priya Raman"));
  next();
}

describe("Calendar keyboard across months", () => {
  it("moves into the next month by week and by day, and back again", async () => {
    toWhen();
    const aug31 = day("Monday, August 31");
    aug31.focus();
    fireEvent.keyDown(aug31, { key: "ArrowDown" });
    await waitFor(() => expect(focused()).toMatch(/^Monday, September 7/));
    expect(screen.getByText("Sep 2026")).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    await waitFor(() => expect(focused()).toMatch(/^Monday, August 31/));
    expect(screen.getByText("Aug 2026")).toBeInTheDocument();

    fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
    await waitFor(() => expect(focused()).toMatch(/^Tuesday, September 1/));

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    await waitFor(() => expect(focused()).toMatch(/^Monday, August 31/));
  });

  it("doesn't move onto a past day", () => {
    toWhen();
    const today = day("Monday, August 17");
    today.focus();
    fireEvent.keyDown(today, { key: "ArrowLeft" });
    expect(focused()).toMatch(/^Monday, August 17/);
    fireEvent.keyDown(today, { key: "ArrowUp" });
    expect(focused()).toMatch(/^Monday, August 17/);
  });
});

describe("Resolve overlap with a session that isn't mine to move", () => {
  it("asks only to keep both or go back", () => {
    serveSessions(
      ALL.map((s) => (s.id === "e-18" ? { ...s, relationship: { ...s.relationship!, coach_id: "someone-else" } } : s))
    );
    renderSchedule();
    fireEvent.click(person("Priya Raman"));
    next();
    fireEvent.click(day("Tuesday, August 18"));
    typeTime("14:30");
    next();
    next();
    expect(screen.getByRole("heading", { name: "Resolve overlap" })).toBeInTheDocument();
    expect(screen.getByText("Keep both, or go back and pick another time.")).toBeInTheDocument();
    expect(screen.queryByText(/Pick a new time for Ehab/)).not.toBeInTheDocument();
    expect(railRow("Resolve overlap")).toHaveTextContent("Keep both or pick another time");
  });
});

describe("Accessible names on the step controls", () => {
  it("names the weekday picker and the Ends choice", () => {
    toWhen();
    fireEvent.click(day("Thursday, August 20"));
    typeTime("09:00");
    next();
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    expect(screen.getByRole("toolbar", { name: "On these days" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Ends" })).toBeInTheDocument();
  });

  it("names the Applies to choice", () => {
    renderMove(E_18);
    fireEvent.click(day("Thursday, August 20"));
    next();
    expect(screen.getByRole("radiogroup", { name: "Applies to" })).toBeInTheDocument();
  });
});

describe("Confirming a change that doesn't move anything", () => {
  it("says the session was updated when only its length changed", async () => {
    const onClose = renderMove(P_18);
    fireEvent.click(screen.getByRole("button", { name: "Increase duration" }));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(move).toHaveBeenCalledWith("p-18", expect.objectContaining({ duration_minutes: 55 }));
    expect(toast.success).toHaveBeenCalledWith("Updated · Priya · Tuesday, August 18, 4:30 PM · 55 min");
  });

  it("says the series was updated when only its rule changed", async () => {
    const onClose = renderMove(E_18, MoveScope.Following);
    next();
    next();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of sessions" }), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Updated · Ehab's series · Weekly, for 4 sessions");
  });

  it("still says rescheduled when the start moves", async () => {
    const onClose = renderMove(P_18);
    fireEvent.click(day("Thursday, August 20"));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Rescheduled · Priya to Thursday, August 20, 4:30 PM");
  });
});
