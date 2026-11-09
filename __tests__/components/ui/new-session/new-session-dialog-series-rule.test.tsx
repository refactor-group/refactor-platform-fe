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
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { createMockSession } from "../../../test-utils";
import { MoveScope } from "@/lib/scheduling";
import { None, Some } from "@/types/option";
import { ALL, E_04, E_11, E_18, NEAREST, NOW, RELATIONSHIPS, ZONE, session } from "../../../lib/scheduling/roster";
import { Frequency, Weekday } from "@/types/recurrence";

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
const createSeries = vi.mocked(CoachingSessionSeriesApi.create);
const push = vi.fn();

function viewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

function serveRelationships(relationships: CoachingRelationshipWithUserNames[]) {
  vi.mocked(useCoachingRelationshipList).mockReturnValue({
    relationships,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingRelationshipList>);
}

const originalNow = Settings.now;

beforeEach(() => {
  vi.clearAllMocks();
  Settings.now = () => NOW.toMillis();
  viewport(true);
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  serveRelationships(RELATIONSHIPS);
  vi.mocked(useNearestEachCoachingSessions).mockReturnValue({ sessions: NEAREST, isLoading: false, isError: undefined });
  vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
    enrichedSessions: ALL,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useEnrichedCoachingSessionsForUser>);
  vi.mocked(useOAuthConnections).mockReturnValue({
    connections: [{ provider: "google" }],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useOAuthConnections>);
  create.mockResolvedValue(createMockSession({ id: "new" }));
  move.mockResolvedValue(createMockSession({ id: "e-18" }));
  createSeries.mockResolvedValue({ coaching_sessions: Array(8).fill(createMockSession()) } as unknown as Awaited<
    ReturnType<typeof CoachingSessionSeriesApi.create>
  >);
});

afterEach(() => {
  Settings.now = originalNow;
  vi.unstubAllGlobals();
});

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

const reschedule = vi.mocked(CoachingSessionSeriesApi.reschedule);

beforeEach(() => {
  vi.mocked(useCoachingSessionSeries).mockReturnValue({
    series: SERIES,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingSessionSeries>);
  reschedule.mockResolvedValue(SERIES as unknown as Awaited<ReturnType<typeof CoachingSessionSeriesApi.reschedule>>);
});

function renderMove(scope = MoveScope.This) {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "move", session: E_18, scope, target: None }} onClose={onClose} />);
  return onClose;
}

const rail = () => within(screen.getByRole("list", { name: "Steps" }));
const railRow = (label: string) => rail().getAllByRole("listitem").find((row) => row.textContent?.startsWith(label));
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));

function serveSeries(series: unknown, state: { isLoading?: boolean; isError?: unknown } = {}) {
  vi.mocked(useCoachingSessionSeries).mockReturnValue({
    series,
    isLoading: state.isLoading ?? false,
    isError: state.isError,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingSessionSeries>);
}

function withRecurrence(frequency: Frequency, interval: number) {
  return { ...SERIES, rule: { ...SERIES.rule, recurrence: { ...SERIES.rule.recurrence, frequency, interval } } };
}

const confirmButton = () => screen.queryByRole("button", { name: "Reschedule this and following" });

describe("NewSessionDialog: this and following keeps the series' interval", () => {
  it("keeps every 3 weeks, shown as its own choice", async () => {
    serveSeries(withRecurrence(Frequency.Weekly, 3));
    const onClose = renderMove(MoveScope.Following);
    expect(railRow("Repeats")).toHaveTextContent("Every 3 weeks, for 3 sessions");
    next();
    next();
    expect(screen.getByRole("button", { name: "Every 3 weeks" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Weekly" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalledWith(
      "series-e",
      expect.objectContaining({
        recurrence: { frequency: "weekly", interval: 3, by_weekdays: ["Tue"], count: 3 },
      }),
      ZONE
    );
  });

  it("keeps every 2 months", async () => {
    serveSeries(withRecurrence(Frequency.Monthly, 2));
    const onClose = renderMove(MoveScope.Following);
    next();
    next();
    expect(screen.getByRole("button", { name: "Every 2 months" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalledWith(
      "series-e",
      expect.objectContaining({ recurrence: { frequency: "monthly", interval: 2, count: 3 } }),
      ZONE
    );
  });

  it("keeps a daily series daily", () => {
    serveSeries(withRecurrence(Frequency.Daily, 1));
    renderMove(MoveScope.Following);
    next();
    next();
    expect(screen.getByRole("button", { name: "Daily" })).toHaveAttribute("aria-pressed", "true");
  });

  it("drops the interval when another choice is picked", async () => {
    serveSeries(withRecurrence(Frequency.Weekly, 3));
    const onClose = renderMove(MoveScope.Following);
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    expect(screen.getByRole("button", { name: "Every 3 weeks" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalledWith(
      "series-e",
      expect.objectContaining({ recurrence: { frequency: "weekly", by_weekdays: ["Tue"], count: 3 } }),
      ZONE
    );
  });
});

describe("NewSessionDialog: the series hasn't loaded", () => {
  it("waits for a series still loading before it can confirm", () => {
    serveSeries({ ...SERIES, id: "" }, { isLoading: true });
    renderMove(MoveScope.Following);
    next();
    next();
    expect(screen.getByText("Loading the series…")).toBeInTheDocument();
    expect(confirmButton()).not.toBeInTheDocument();
  });

  it("falls back to this session only when the series fails to load", async () => {
    serveSeries({ ...SERIES, id: "" }, { isError: new Error("boom") });
    const onClose = renderMove(MoveScope.Following);
    expect(railRow("Applies to")).toHaveTextContent("This session only");
    expect(railRow("Repeats")).toBeUndefined();
    fireEvent.click(day("Thursday, August 20"));
    next();
    expect(screen.getByText("Couldn't load the series, so only this session can change.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /This and following sessions/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(move).toHaveBeenCalledWith("e-18", expect.objectContaining({ date: "2026-08-20T19:30:00" }));
    expect(reschedule).not.toHaveBeenCalled();
  });
});

describe("NewSessionDialog: Repeat while the series loads", () => {
  it("can't be edited until the rule arrives, then shows the rule", () => {
    serveSeries({ ...SERIES, id: "" }, { isLoading: true });
    const { rerender } = render(
      <NewSessionDialog request={{ kind: "move", session: E_18, scope: MoveScope.Following, target: None }} onClose={vi.fn()} />
    );
    next();
    next();
    expect(screen.getByRole("button", { name: "Monthly" })).toBeDisabled();
    expect(screen.getByRole("spinbutton", { name: "Number of sessions" })).toBeDisabled();

    serveSeries(withRecurrence(Frequency.Monthly, 1));
    rerender(<NewSessionDialog request={{ kind: "move", session: E_18, scope: MoveScope.Following, target: None }} onClose={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Monthly" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
  });
});
