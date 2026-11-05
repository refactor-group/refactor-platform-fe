import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import type { Week } from "@/lib/week-grid/week";
import { SessionAction } from "@/lib/session-actions";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { WeekPanel } from "@/components/ui/dashboard/week-grid/week-panel";
import { createMockEnrichedSession } from "../../../../test-utils";

const TZ = "America/Chicago";
// Tuesday, August 18, 1:45 PM in Chicago.
const NOW = new Date("2026-08-18T18:45:00Z");

const session = (id: string, date: string) =>
  createMockEnrichedSession({ id, date, duration_minutes: 50, topics: [] });
const LATE_TODAY = session("late-today", "2026-08-18T21:30:00");
const EARLY_TODAY = session("early-today", "2026-08-18T15:00:00");
const THURSDAY = session("thursday", "2026-08-20T15:00:00");
const NEXT_WEEK = session("next-week", "2026-08-25T15:00:00");

interface WeekSessionsResult {
  sessions: EnrichedCoachingSession[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}
const refresh = vi.fn();
let result: WeekSessionsResult;
const requestedWeeks: Week[] = [];
vi.mock("@/lib/hooks/use-week-sessions", () => ({
  useWeekSessions: (week: Week) => {
    requestedWeeks.push(week);
    return result;
  },
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ userId: "coach-1", userSession: { id: "coach-1", timezone: TZ } }),
}));
vi.mock("@/lib/hooks/use-schedule-data", () => ({ useScheduleTimezone: () => TZ }));

const run = vi.fn();
let actionsInput: Record<string, unknown> = {};
vi.mock("@/components/ui/dashboard/use-session-actions", () => ({
  useSessionActions: (input: Record<string, unknown>) => {
    actionsInput = input;
    return { run, dialogs: {} };
  },
}));
vi.mock("@/components/ui/dashboard/session-action-dialogs", () => ({ SessionActionDialogs: () => null }));

const onReschedule = vi.fn();
const onSeriesMutated = vi.fn();
const renderPanel = () => render(<WeekPanel onReschedule={onReschedule} onSeriesMutated={onSeriesMutated} />);
const day = (label: string) => screen.getByRole("group", { name: label });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  requestedWeeks.length = 0;
  vi.clearAllMocks();
  result = {
    sessions: [LATE_TODAY, THURSDAY, EARLY_TODAY, NEXT_WEEK],
    isLoading: false,
    isError: false,
    refresh,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("WeekPanel", () => {
  it("fetches the current week, Monday to Sunday in the profile zone", () => {
    renderPanel();
    const week = requestedWeeks[0];
    expect(week.start.zoneName).toBe(TZ);
    expect(week.start.toISODate()).toBe("2026-08-17");
    expect(week.days).toHaveLength(7);
  });

  it("titles the week and counts its sessions", () => {
    renderPanel();
    const panel = screen.getByRole("region", { name: "This week" });
    expect(panel).toHaveTextContent("Aug 17 – 23");
    expect(panel).toHaveTextContent("3 sessions · 2 today");
  });

  it("shows seven days, Monday first, and marks today", () => {
    renderPanel();
    const days = screen.getAllByRole("group");
    expect(days).toHaveLength(7);
    expect(days[0]).toHaveAccessibleName("Monday, August 17");
    expect(days[6]).toHaveAccessibleName("Sunday, August 23");
    expect(day("Tuesday, August 18")).toHaveAttribute("aria-current", "date");
    expect(day("Wednesday, August 19")).not.toHaveAttribute("aria-current");
  });

  it("puts each session on its day once, sorted by start, and drops other weeks", () => {
    renderPanel();
    const tuesdayCards = within(day("Tuesday, August 18")).getAllByTestId(/^session-card-/);
    expect(tuesdayCards.map((c) => c.dataset.testid)).toEqual([
      "session-card-early-today",
      "session-card-late-today",
    ]);
    expect(within(day("Thursday, August 20")).getByTestId("session-card-thursday")).toBeInTheDocument();
    expect(within(day("Wednesday, August 19")).queryAllByTestId(/^session-card-/)).toHaveLength(0);
    expect(screen.queryByTestId("session-card-next-week")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/^session-card-/)).toHaveLength(3);
  });

  it("leaves out today's count when nothing falls today", () => {
    result = { ...result, sessions: [THURSDAY] };
    renderPanel();
    const panel = screen.getByRole("region", { name: "This week" });
    expect(panel).toHaveTextContent("1 session");
    expect(panel).not.toHaveTextContent("today");
  });

  it("runs a card's menu action through the shared session actions", () => {
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId("session-card-thursday"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Reschedule…" }));
    expect(run).toHaveBeenCalledWith(SessionAction.Reschedule, THURSDAY);
  });

  it("hands the dashboard's reschedule and series callbacks to the session actions", () => {
    renderPanel();
    expect(actionsInput.onReschedule).toBe(onReschedule);
    expect(actionsInput.onSeriesMutated).toBe(onSeriesMutated);
    expect(actionsInput.userTimezone).toBe(TZ);
    expect(typeof actionsInput.onSessionsChanged).toBe("function");
  });

  it("shows an error with a retry instead of an empty week", () => {
    result = { ...result, sessions: [], isError: true };
    renderPanel();
    expect(screen.getByText("Couldn't load this week's sessions.")).toBeInTheDocument();
    expect(screen.queryByText(/0 sessions/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("group")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("marks the panel busy while loading, without a count", () => {
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    const panel = screen.getByRole("region", { name: "This week" });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(panel).not.toHaveTextContent(/sessions?\b/);
  });
});

describe("WeekPanel live clock", () => {
  it("rebuilds the cards from the current time", () => {
    const soon = session("soon", DateTime.fromJSDate(NOW).plus({ minutes: 40 }).toUTC().toFormat("yyyy-LL-dd'T'HH:mm:ss"));
    result = { ...result, sessions: [soon] };
    renderPanel();
    expect(screen.getByTestId("session-card-soon")).toHaveTextContent("in 40 min");
  });
});
