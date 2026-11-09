import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import type { Week } from "@/lib/week-grid/week";
import { SessionAction } from "@/lib/session-actions";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { WeekPanel } from "@/components/ui/dashboard/week-grid/week-panel";
import { WeekGridStoreProvider } from "@/lib/providers/week-grid-store-provider";
import type { WeekEdges } from "@/lib/week-grid/week";
import { PersonGroup, type FilterPerson } from "@/lib/week-grid/filter";
import { None, Some, type Option } from "@/types/option";
import { createMockEnrichedSession } from "../../../../test-utils";

const TZ = "America/Chicago";
// Tuesday, August 18, 1:45 PM in Chicago.
const NOW = new Date("2026-08-18T18:45:00Z");

const session = (id: string, date: string) =>
  createMockEnrichedSession({ id, date, duration_minutes: 50, topics: Some([]) });
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

let isACoach = true;
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ userId: "coach-1", isACoach, userSession: { id: "coach-1", timezone: TZ } }),
}));

let edges: WeekEdges = { hasEarlier: true, hasLater: true };
vi.mock("@/lib/hooks/use-week-edges", () => ({ useWeekEdges: () => edges }));

const ALEX: FilterPerson = { userId: "u-alex", fullName: "Alex Chen", relationshipIds: ["rel-1"], group: PersonGroup.Coachees };
const SAM: FilterPerson = { userId: "u-sam", fullName: "Sam Ruiz", relationshipIds: ["rel-sam"], group: PersonGroup.Coachees };
let selectedPerson: Option<FilterPerson> = None;
const selectPerson = vi.fn();
const clearPerson = vi.fn();
vi.mock("@/lib/hooks/use-week-filter", () => ({
  useWeekFilter: () => ({
    people: [ALEX, SAM],
    grouped: true,
    selected: selectedPerson,
    select: selectPerson,
    clear: clearPerson,
    load: vi.fn(),
  }),
}));

const toast = vi.fn();
vi.mock("@/lib/toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));
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
const onSchedule = vi.fn();
const renderPanel = () =>
  render(
    <WeekGridStoreProvider>
      <WeekPanel onReschedule={onReschedule} onSeriesMutated={onSeriesMutated} onSchedule={onSchedule} />
    </WeekGridStoreProvider>
  );
const day = (label: string) => screen.getByRole("group", { name: label });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  requestedWeeks.length = 0;
  vi.clearAllMocks();
  isACoach = true;
  edges = { hasEarlier: true, hasLater: true };
  selectedPerson = None;
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
    const days = screen.getAllByRole("group", { name: /, August/ });
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
    expect(panel).not.toHaveTextContent(/\d+ today/);
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
    expect(screen.queryAllByRole("group", { name: /, August/ })).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the week's seven days on screen while it loads", () => {
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    const days = screen.getAllByRole("group", { name: /, August/ });
    expect(days).toHaveLength(7);
    expect(days[1]).toHaveAccessibleName("Tuesday, August 18");
    expect(screen.queryAllByTestId(/^session-card-/)).toHaveLength(0);
  });

  it("marks the panel busy while loading, without a count", () => {
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    const panel = screen.getByRole("region", { name: "This week" });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(panel).not.toHaveTextContent(/\d+ sessions?\b/);
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

const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("WeekPanel paging", () => {
  it("pages forward and back, titling each week", () => {
    renderPanel();
    fireEvent.click(button("Next week"));
    expect(screen.getByRole("region", { name: "Next week" })).toHaveTextContent("Aug 24 – 30");
    expect(requestedWeeks.at(-1)?.start.toISODate()).toBe("2026-08-24");
    fireEvent.click(button("Next week"));
    expect(screen.getByRole("region", { name: "Week of Aug 31" })).toHaveTextContent("Aug 31 – Sep 6");
    fireEvent.click(button("Previous week"));
    fireEvent.click(button("Previous week"));
    fireEvent.click(button("Previous week"));
    expect(screen.getByRole("region", { name: "Last week" })).toBeInTheDocument();
  });

  it("returns to this week, and This week is disabled while there", () => {
    renderPanel();
    expect(button("This week")).toBeDisabled();
    fireEvent.click(button("Next week"));
    expect(button("This week")).toBeEnabled();
    fireEvent.click(button("This week"));
    expect(screen.getByRole("region", { name: "This week" })).toBeInTheDocument();
  });

  it("drops today's count away from the current week", () => {
    result = { ...result, sessions: [] };
    renderPanel();
    fireEvent.click(button("Next week"));
    expect(screen.getByRole("region", { name: "Next week" })).not.toHaveTextContent("today");
  });

  it("stops the previous arrow at the viewer's first session", () => {
    edges = { hasEarlier: false, hasLater: true };
    renderPanel();
    expect(button("Previous week")).toBeDisabled();
    expect(button("Next week")).toBeEnabled();
  });

  it("never stops a coach paging forward, so any future week can be scheduled", () => {
    edges = { hasEarlier: true, hasLater: false };
    renderPanel();
    expect(button("Next week")).toBeEnabled();
  });

  it("stops a coachee's next arrow at their last session", () => {
    isACoach = false;
    edges = { hasEarlier: true, hasLater: false };
    renderPanel();
    expect(button("Next week")).toBeDisabled();
  });
});

describe("WeekPanel scheduling", () => {
  it("opens the dialog with no day from Schedule session", () => {
    renderPanel();
    fireEvent.click(button("Schedule session"));
    expect(onSchedule).toHaveBeenCalledTimes(1);
    expect(onSchedule.mock.calls[0][0].none).toBe(true);
  });

  it("opens the dialog on an empty day of the current week", () => {
    renderPanel();
    fireEvent.click(within(day("Wednesday, August 19")).getByRole("button", { name: "Schedule on Wednesday, August 19" }));
    const [date] = onSchedule.mock.calls[0];
    expect(date.some && date.val.toISODate()).toBe("2026-08-19");
  });

  it("offers no schedule on a past day", () => {
    renderPanel();
    expect(within(day("Monday, August 17")).queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers schedule on every empty day of a future week", () => {
    result = { ...result, sessions: [] };
    renderPanel();
    fireEvent.click(button("Next week"));
    expect(screen.getAllByRole("button", { name: /^Schedule on/ })).toHaveLength(7);
    fireEvent.click(within(day("Monday, August 24")).getByRole("button", { name: "Schedule on Monday, August 24" }));
    const [date] = onSchedule.mock.calls[0];
    expect(date.some && date.val.toISODate()).toBe("2026-08-24");
  });

  it("offers no schedule anywhere in a past week", () => {
    result = { ...result, sessions: [] };
    renderPanel();
    fireEvent.click(button("Previous week"));
    expect(screen.queryByRole("button", { name: /^Schedule on/ })).not.toBeInTheDocument();
  });

  it("keeps Schedule session while a week loads", () => {
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    expect(button("Schedule session")).toBeInTheDocument();
  });

  it("hides scheduling from someone who coaches nobody, but keeps the arrows", () => {
    isACoach = false;
    renderPanel();
    expect(screen.queryByRole("button", { name: "Schedule session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Schedule on/ })).not.toBeInTheDocument();
    expect(button("Next week")).toBeInTheDocument();
  });
});

describe("WeekPanel card clicks", () => {
  it.each([
    ["an upcoming session", "thursday"],
    ["a past session", "early-today"],
  ])("opens %s on a single click", (_label, id) => {
    renderPanel();
    fireEvent.click(screen.getByTestId(`session-card-${id}`));
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(SessionAction.OpenSession, id === "thursday" ? THURSDAY : EARLY_TODAY);
  });

  it("opens a session that's under way on a single click", () => {
    const underway = session("underway", "2026-08-18T18:25:00");
    result = { ...result, sessions: [underway] };
    renderPanel();
    fireEvent.click(screen.getByTestId("session-card-underway"));
    expect(run).toHaveBeenCalledWith(SessionAction.OpenSession, underway);
  });

  it("never reschedules or shows a toast on a click", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("session-card-thursday"));
    fireEvent.click(screen.getByTestId("session-card-early-today"));
    expect(run).not.toHaveBeenCalledWith(SessionAction.Reschedule, expect.anything());
    expect(toast).not.toHaveBeenCalled();
  });
});

const SAM_FRIDAY = createMockEnrichedSession({
  id: "sam-friday",
  date: "2026-08-21T15:00:00",
  duration_minutes: 50,
  topics: Some([]),
  coaching_relationship_id: "rel-sam",
});

describe("WeekPanel person filter", () => {
  it("shows the filter pill to a coach only", () => {
    renderPanel();
    expect(button("All sessions")).toBeInTheDocument();
  });

  it("hides the filter from someone who coaches nobody", () => {
    isACoach = false;
    renderPanel();
    expect(screen.queryByRole("button", { name: "All sessions" })).not.toBeInTheDocument();
  });

  it("dims other people's cards in place and counts only the visible ones", () => {
    selectedPerson = Some(SAM);
    result = { ...result, sessions: [THURSDAY, SAM_FRIDAY, LATE_TODAY] };
    renderPanel();
    expect(screen.getByTestId("session-card-thursday")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("session-card-late-today")).toHaveAttribute("data-dimmed", "true");
    expect(screen.getByTestId("session-card-sam-friday")).toHaveAttribute("data-dimmed", "false");
    expect(screen.getAllByTestId(/^session-card-/)).toHaveLength(3);
    const panel = screen.getByRole("region", { name: "This week" });
    expect(panel).toHaveTextContent("1 session");
    expect(panel).not.toHaveTextContent("today");
  });

  it("shows a removable chip for the selected person", () => {
    selectedPerson = Some(SAM);
    renderPanel();
    fireEvent.click(button("Clear Sam Ruiz"));
    expect(clearPerson).toHaveBeenCalledTimes(1);
  });

  it("says when nothing in the week matches", () => {
    selectedPerson = Some(SAM);
    renderPanel();
    expect(screen.getByText("No sessions match this week.")).toBeInTheDocument();
  });

  it("stays quiet when nothing is filtered", () => {
    result = { ...result, sessions: [] };
    renderPanel();
    expect(screen.queryByText("No sessions match this week.")).not.toBeInTheDocument();
  });
});

