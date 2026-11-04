import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { toSessionDate } from "@/lib/session-window";
import { Frequency, Weekday } from "@/types/recurrence";
import { createMockSession } from "../../../test-utils";
import { ALL, E_04, E_11, E_18, NEAREST, NOW, RELATIONSHIPS, ZONE, at, session } from "../../../lib/scheduling/roster";

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
    CoachingSessionApi: { ...actual.CoachingSessionApi, create: vi.fn(), update: vi.fn() },
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
const update = vi.mocked(CoachingSessionApi.update);
const reschedule = vi.mocked(CoachingSessionSeriesApi.reschedule);

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };
const E_25 = session({ id: "e-25", relationshipId: "rel-e", person: EHAB, start: "2026-08-25T14:30", series: "series-e" });
const E_01 = session({ id: "e-01", relationshipId: "rel-e", person: EHAB, start: "2026-09-01T14:30", series: "series-e" });
/** Ehab's Tuesday 2:30 PM series session, moved on its own to Wednesday 9:00 AM; its slot stays Tuesday. */
const E_18_MOVED = {
  ...E_18,
  date: toSessionDate(at("2026-08-19T09:00")),
  ical_recurrence_id: Some(toSessionDate(at("2026-08-18T14:30"))),
};

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
  coaching_sessions: [E_04, E_11, E_18_MOVED, E_25, E_01],
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
  update.mockResolvedValue(createMockSession({ id: "p-18" }));
  reschedule.mockResolvedValue(SERIES as unknown as Awaited<ReturnType<typeof CoachingSessionSeriesApi.reschedule>>);
});

afterEach(() => {
  Settings.now = originalNow;
  vi.unstubAllGlobals();
});

function renderMove(target: EnrichedCoachingSession, scope = MoveScope.This) {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "move", session: target, scope }} onClose={onClose} />);
  return onClose;
}

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });

describe("This and following from a session that was moved on its own", () => {
  it("swaps the series' weekday, not the moved session's, for the new one", async () => {
    const onClose = renderMove(E_18_MOVED);
    expect(screen.getByText("Currently Wed, Aug 19, 9:00 AM")).toBeInTheDocument();
    fireEvent.click(day("Thursday, August 20"));
    typeTime("14:30");
    next();
    fireEvent.click(screen.getByRole("radio", { name: /This and following sessions/ }));
    next();
    expect(screen.getByRole("button", { name: "Thursday" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tuesday" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Wednesday" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText(/which is your first session's day/)).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Number of sessions" })).toHaveValue(3);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalledWith(
      "series-e",
      {
        coaching_session_id: "e-18",
        start_at: "2026-08-20T19:30:00",
        duration_minutes: 50,
        recurrence: { frequency: "weekly", by_weekdays: ["Thu"], count: 3 },
      },
      ZONE
    );
  });
});
