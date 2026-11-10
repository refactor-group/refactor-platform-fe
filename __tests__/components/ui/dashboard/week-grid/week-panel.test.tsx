import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import type { Week } from "@/lib/week-grid/week";
import { SessionAction } from "@/lib/session-actions";
import { MoveScope } from "@/lib/scheduling";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { WeekPanel } from "@/components/ui/dashboard/week-grid/week-panel";
import { WeekGridStoreProvider, useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
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
const MONDAY_PAST = session("monday-past", "2026-08-17T15:00:00");
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
const prefetchedAround: Week[] = [];
let adjacent: EnrichedCoachingSession[] = [];
let adjacentLoaded = true;
vi.mock("@/lib/hooks/use-week-sessions", () => ({
  useWeekSessions: (week: Week) => {
    requestedWeeks.push(week);
    return result;
  },
  useAdjacentWeekSessions: (week: Week) => {
    prefetchedAround.push(week);
    const span = adjacentLoaded ? 1 : 0;
    return {
      sessions: adjacent,
      known: { from: week.start.minus({ weeks: span }), to: week.start.plus({ weeks: 1 + span }) },
    };
  },
}));

let isACoach = true;
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ userId: "coach-1", isACoach, userSession: { id: "coach-1", timezone: TZ } }),
}));

let edges: WeekEdges = { hasEarlier: true };
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

const moveSession = vi.fn();
vi.mock("@/lib/hooks/use-move-session", () => ({ useMoveSession: () => moveSession }));

let wide = true;
let widthKnown = true;
vi.mock("@/lib/hooks/use-media-query", () => ({
  useMediaQuery: (query: string) => (query === "(min-width: 1024px)" ? (widthKnown ? Some(wide) : None) : Some(false)),
}));

const toast = vi.fn();
vi.mock("@/lib/toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));
vi.mock("@/lib/hooks/use-schedule-data", () => ({ useScheduleTimezone: () => TZ }));

let actionsInput: Record<string, unknown> = {};
// Like the real hook, Move goes to the onMove the panel hands it.
const run = vi.fn((action: SessionAction, session: EnrichedCoachingSession) => {
  if (action === SessionAction.Move) (actionsInput.onMove as (s: EnrichedCoachingSession) => void)(session);
});
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
  prefetchedAround.length = 0;
  adjacent = [];
  adjacentLoaded = true;
  vi.clearAllMocks();
  isACoach = true;
  edges = { hasEarlier: true };
  selectedPerson = None;
  wide = true;
  widthKnown = true;
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

  it("fetches the weeks either side of the shown one ahead of time", () => {
    renderPanel();
    expect(prefetchedAround.at(-1)?.start.toISODate()).toBe("2026-08-17");
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(prefetchedAround.at(-1)?.start.toISODate()).toBe("2026-08-24");
  });

  it("shows no pulsing placeholder while a week loads, on either layout", () => {
    result = { ...result, sessions: [], isLoading: true };
    const { container, unmount } = renderPanel();
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    unmount();
    wide = false;
    const phone = renderPanel();
    expect(phone.container.querySelectorAll(".animate-pulse")).toHaveLength(0);
    expect(screen.getByRole("status", { name: "Loading sessions" })).toBeInTheDocument();
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

  it("keeps the seven days on a failed first load, with a retry", () => {
    result = { ...result, sessions: [], isError: true };
    renderPanel();
    expect(screen.getByText("Couldn't load this week's sessions.").closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText(/0 sessions/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: /, August/ })).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /^Schedule on/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("doesn't call a day empty when nothing loaded", () => {
    result = { ...result, sessions: [], isError: true };
    renderPanel();
    expect(screen.queryByText("No sessions today")).not.toBeInTheDocument();
  });

  it("doesn't call a phone's day empty when nothing loaded", () => {
    wide = false;
    result = { ...result, sessions: [], isError: true };
    renderPanel();
    expect(screen.getByRole("heading", { name: "Tuesday, August 18" })).toBeInTheDocument();
    expect(screen.queryByText("No sessions")).not.toBeInTheDocument();
  });

  it("says No sessions today when today loaded empty", () => {
    result = { ...result, sessions: [THURSDAY] };
    renderPanel();
    expect(screen.getByText("No sessions today")).toBeInTheDocument();
  });

  it("explains how to open a card only when the week has cards", () => {
    const { unmount } = renderPanel();
    expect(screen.getByText(/^Enter opens the session/)).toBeInTheDocument();
    unmount();
    result = { ...result, sessions: [] };
    renderPanel();
    expect(screen.queryByText(/^Enter opens the session/)).not.toBeInTheDocument();
  });

  it("keeps the week's seven days on screen while it loads", () => {
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    const days = screen.getAllByRole("group", { name: /, August/ });
    expect(days).toHaveLength(7);
    expect(days[1]).toHaveAccessibleName("Tuesday, August 18");
    expect(screen.queryAllByTestId(/^session-card-/)).toHaveLength(0);
  });

  it("keeps a phone's day strip and day heading while a week loads", () => {
    wide = false;
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    expect(screen.getByRole("button", { name: "Tuesday, August 18" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tuesday, August 18" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading sessions" })).toBeInTheDocument();
    expect(screen.queryByText("No sessions")).not.toBeInTheDocument();
  });

  it("marks the panel busy while loading, without a count", () => {
    result = { ...result, sessions: [], isLoading: true };
    renderPanel();
    const panel = screen.getByRole("region", { name: "This week" });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(panel).not.toHaveTextContent(/\d+ sessions?\b/);
  });
});

describe("WeekPanel before the screen width is known", () => {
  it("shows both loading layouts, letting CSS pick one, and no cards yet", () => {
    widthKnown = false;
    renderPanel();
    const grid = screen.getByTestId("week-grid-pending");
    expect(grid).toHaveClass("hidden", "lg:block");
    expect(within(grid).getAllByRole("group", { name: /, August/ })).toHaveLength(7);
    expect(screen.getByTestId("day-agenda-pending")).toHaveClass("lg:hidden");
    expect(screen.queryAllByTestId(/^session-card-/)).toHaveLength(0);
    expect(screen.getByRole("region", { name: "This week" })).toHaveAttribute("aria-busy", "true");
  });

  it("puts a phone's way back between the week arrows, disabled on the current week", () => {
    widthKnown = false;
    renderPanel();
    const home = screen.getByRole("button", { name: "Back to current week" });
    expect(home).toBeDisabled();
    expect(home).toHaveClass("lg:hidden");
    expect(home.textContent).toBe("");
    expect(button("Previous week").nextElementSibling?.nextElementSibling).toBe(home);
    expect(home.nextElementSibling).toBe(button("Next week"));
    fireEvent.click(button("Next week"));
    expect(screen.getByRole("button", { name: "Back to current week" })).toBeEnabled();
  });

  it("renders the chosen layout alone once the width is known", () => {
    renderPanel();
    expect(screen.queryByTestId("week-grid-pending")).not.toBeInTheDocument();
    expect(screen.queryByTestId("day-agenda-pending")).not.toBeInTheDocument();
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
    edges = { hasEarlier: false };
    renderPanel();
    expect(button("Previous week")).toBeDisabled();
    expect(button("Next week")).toBeEnabled();
  });

  it("never stops a coach paging forward, so any future week can be scheduled", () => {
    renderPanel();
    expect(button("Next week")).toBeEnabled();
  });

  it("lets a coachee page forward too, even with nothing left scheduled", () => {
    isACoach = false;
    renderPanel();
    expect(button("Next week")).toBeEnabled();
    fireEvent.click(button("Next week"));
    expect(screen.getByRole("region", { name: "Next week" })).toBeInTheDocument();
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

  it("opens a card from an earlier day on a single click", () => {
    result = { ...result, sessions: [...result.sessions, MONDAY_PAST] };
    renderPanel();
    fireEvent.click(screen.getByTestId("session-card-monday-past"));
    expect(run).toHaveBeenCalledWith(SessionAction.OpenSession, MONDAY_PAST);
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

  it("doesn't say nothing matches when the week failed to load", () => {
    selectedPerson = Some(SAM);
    result = { ...result, sessions: [], isError: true };
    renderPanel();
    expect(screen.getByText("Couldn't load this week's sessions.")).toBeInTheDocument();
    expect(screen.queryByText("No sessions match this week.")).not.toBeInTheDocument();
  });

  it("stays quiet when nothing is filtered", () => {
    result = { ...result, sessions: [] };
    renderPanel();
    expect(screen.queryByText("No sessions match this week.")).not.toBeInTheDocument();
  });
});

describe("WeekPanel below 1024px", () => {
  beforeEach(() => {
    wide = false;
  });

  const pill = (name: string) => screen.getByRole("button", { name });

  it("swaps the columns for a day strip and today's agenda", () => {
    renderPanel();
    expect(screen.queryAllByRole("group", { name: /, August/ })).toHaveLength(0);
    expect(pill("Tuesday, August 18")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Tuesday, August 18" })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^session-card-/).map((c) => c.dataset.testid)).toEqual([
      "session-card-early-today",
      "session-card-late-today",
    ]);
  });

  it("shows another day's sessions when its pill is tapped", () => {
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    expect(screen.getByRole("heading", { name: "Thursday, August 20" })).toBeInTheDocument();
    expect(screen.getAllByTestId(/^session-card-/).map((c) => c.dataset.testid)).toEqual(["session-card-thursday"]);
  });

  it("says No sessions on an empty day, leaving scheduling to Schedule session", () => {
    renderPanel();
    fireEvent.click(pill("Wednesday, August 19"));
    expect(screen.getByText("No sessions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Schedule on/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule session" })).toBeInTheDocument();
  });

  it("opens a session from its agenda card", () => {
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.click(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Open session" }));
    expect(run).toHaveBeenCalledWith(SessionAction.OpenSession, THURSDAY);
  });

  it("selects Monday on another week, and offers a way back", () => {
    renderPanel();
    expect(button("Back to current week")).toBeDisabled();
    fireEvent.click(button("Next week"));
    expect(pill("Monday, August 24")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button("Back to current week"));
    expect(screen.getByRole("region", { name: "This week" })).toBeInTheDocument();
    expect(pill("Tuesday, August 18")).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the filter's dimming in the agenda", () => {
    selectedPerson = Some(SAM);
    renderPanel();
    expect(screen.getByTestId("session-card-late-today")).toHaveAttribute("data-dimmed", "true");
  });
});

describe("WeekPanel Move sheet below 1024px", () => {
  beforeEach(() => {
    wide = false;
  });

  const pill = (name: string) => screen.getByRole("button", { name });
  const moveSheet = () => screen.getByRole("dialog", { name: "Move Alex's session" });

  it("offers Move on an agenda card the viewer can still change, and not on an earlier day's", () => {
    result = { ...result, sessions: [...result.sessions, MONDAY_PAST] };
    renderPanel();
    expect(within(screen.getByTestId("session-card-early-today")).getByRole("button", { name: "Move" })).toBeInTheDocument();
    fireEvent.click(pill("Monday, August 17"));
    expect(within(screen.getByTestId("session-card-monday-past")).queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    fireEvent.click(pill("Thursday, August 20"));
    expect(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Move" })).toBeInTheDocument();
  });

  it("offers no Move to someone who coaches nobody", () => {
    isACoach = false;
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    expect(within(screen.getByTestId("session-card-thursday")).queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
  });

  it("moves the session to a picked time through the sheet", () => {
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.click(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Move" }));
    const time = within(moveSheet()).getByLabelText("Start time");
    expect(time).toHaveValue("10:00");
    fireEvent.change(time, { target: { value: "11:00" } });
    fireEvent.click(within(moveSheet()).getByRole("button", { name: "Move session" }));
    expect(moveSession).toHaveBeenCalledTimes(1);
    const [{ session, name, to }] = moveSession.mock.calls[0];
    expect(session).toBe(THURSDAY);
    expect(name).toBe("Alex Chen");
    expect(to.toISO()).toBe(DateTime.fromISO("2026-08-20T11:00", { zone: TZ }).toISO());
    expect(screen.queryByRole("dialog", { name: "Move Alex's session" })).not.toBeInTheDocument();
  });

  it("checks a move that runs into next week against next week's sessions", () => {
    adjacent = [session("next-monday", "2026-08-24T05:00:00")];
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.click(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Move" }));
    fireEvent.click(within(moveSheet()).getByRole("button", { name: "Sunday, August 23" }));
    fireEvent.change(within(moveSheet()).getByLabelText("Start time"), { target: { value: "23:45" } });
    expect(within(moveSheet()).getByRole("button", { name: "Resolve overlap…" })).toBeEnabled();
  });

  it("won't move into next week before next week's sessions have loaded", () => {
    adjacentLoaded = false;
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.click(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Move" }));
    fireEvent.click(within(moveSheet()).getByRole("button", { name: "Sunday, August 23" }));
    fireEvent.change(within(moveSheet()).getByLabelText("Start time"), { target: { value: "23:45" } });
    expect(within(moveSheet()).getByRole("button", { name: "Move session" })).toBeDisabled();
  });

  it("closes an open Move sheet when the week's read fails, so nothing moves on stale times", () => {
    const { rerender } = renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.click(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Move" }));
    expect(moveSheet()).toBeInTheDocument();
    result = { ...result, isError: true };
    rerender(
      <WeekGridStoreProvider>
        <WeekPanel onReschedule={onReschedule} onSeriesMutated={onSeriesMutated} onSchedule={onSchedule} />
      </WeekGridStoreProvider>
    );
    expect(screen.queryByRole("dialog", { name: "Move Alex's session" })).not.toBeInTheDocument();
    expect(moveSession).not.toHaveBeenCalled();
  });

  it("opens the same sheet from the long-press menu's Move…", () => {
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.contextMenu(screen.getByTestId("session-card-thursday"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move…" }));
    expect(run).toHaveBeenCalledWith(SessionAction.Move, THURSDAY);
    expect(moveSheet()).toBeInTheDocument();
  });

  it("sends a time that overlaps another session to the reschedule dialog's overlap step", () => {
    result = { ...result, sessions: [THURSDAY, { ...SAM_FRIDAY, id: "sam-thursday", date: "2026-08-20T17:00:00" }] };
    renderPanel();
    fireEvent.click(pill("Thursday, August 20"));
    fireEvent.click(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Move" }));
    fireEvent.change(within(moveSheet()).getByLabelText("Start time"), { target: { value: "12:15" } });
    fireEvent.click(within(moveSheet()).getByRole("button", { name: "Resolve overlap…" }));
    expect(moveSession).not.toHaveBeenCalled();
    expect(onReschedule).toHaveBeenCalledTimes(1);
    const [session, scope, target] = onReschedule.mock.calls[0];
    expect(session).toBe(THURSDAY);
    expect(scope).toBe(MoveScope.This);
    expect(target.some && target.val.toISO()).toBe(DateTime.fromISO("2026-08-20T12:15", { zone: TZ }).toISO());
    expect(screen.queryByRole("dialog", { name: "Move Alex's session" })).not.toBeInTheDocument();
  });
});

describe("WeekPanel desktop menu", () => {
  it("has no Move… on the wide layout", () => {
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId("session-card-thursday"));
    expect(screen.queryByRole("menuitem", { name: "Move…" })).not.toBeInTheDocument();
  });
});

function MarkMoved({ id }: { id: string }) {
  const markMoved = useWeekGridStore((s) => s.markMoved);
  return <button onClick={() => markMoved(id)}>mark {id}</button>;
}
function MovedCount() {
  return <output aria-label="moved count">{useWeekGridStore((s) => s.recentlyMoved.length)}</output>;
}

describe("WeekPanel moved cards (D10)", () => {
  it("reads Moved on a card the viewer just moved", () => {
    render(
      <WeekGridStoreProvider>
        <MarkMoved id="thursday" />
        <WeekPanel onReschedule={onReschedule} onSeriesMutated={onSeriesMutated} onSchedule={onSchedule} />
      </WeekGridStoreProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "mark thursday" }));
    expect(screen.getByTestId("session-card-thursday")).toHaveTextContent("Moved");
    expect(screen.getByTestId("session-card-late-today")).not.toHaveTextContent("Moved");
  });

  it("forgets moved cards once the panel goes away", () => {
    const tree = (withPanel: boolean) => (
      <WeekGridStoreProvider>
        <MarkMoved id="thursday" />
        <MovedCount />
        {withPanel && <WeekPanel onReschedule={onReschedule} onSeriesMutated={onSeriesMutated} onSchedule={onSchedule} />}
      </WeekGridStoreProvider>
    );
    const { rerender } = render(tree(true));
    fireEvent.click(screen.getByRole("button", { name: "mark thursday" }));
    expect(screen.getByLabelText("moved count")).toHaveTextContent("1");
    rerender(tree(false));
    expect(screen.getByLabelText("moved count")).toHaveTextContent("0");
  });
});

describe("WeekPanel when the server can't be reached (read only)", () => {
  beforeEach(() => {
    result = { ...result, isError: true };
  });

  it("keeps showing the sessions it already loaded, with a notice and a retry", () => {
    renderPanel();
    expect(screen.getAllByTestId(/^session-card-/)).toHaveLength(3);
    expect(screen.getByRole("region", { name: "This week" })).toHaveTextContent("3 sessions · 2 today");
    expect(
      screen.getByText("Can't reach the server right now. These sessions may be out of date.").closest('[role="status"]')
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disables scheduling and hides the empty-day schedule", () => {
    renderPanel();
    expect(button("Schedule session")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /^Schedule on/ })).not.toBeInTheDocument();
  });

  it("offers only Open session in the menu, and a single click opens the session", () => {
    renderPanel();
    fireEvent.contextMenu(screen.getByTestId("session-card-thursday"));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent?.trim())).toEqual(["Open session"]);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    fireEvent.click(screen.getByTestId("session-card-thursday"));
    expect(run).toHaveBeenCalledWith(SessionAction.OpenSession, THURSDAY);
  });

  it("doesn't let cards drag", () => {
    renderPanel();
    expect(screen.getByTestId("session-card-thursday")).toHaveAttribute("data-draggable", "false");
  });

  it("still filters and pages", () => {
    selectedPerson = Some(SAM);
    renderPanel();
    expect(screen.getByTestId("session-card-thursday")).toHaveAttribute("data-dimmed", "true");
    fireEvent.click(button("Next week"));
    expect(screen.getByRole("region", { name: "Next week" })).toBeInTheDocument();
  });

  it("offers no Move in the agenda", () => {
    wide = false;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Thursday, August 20" }));
    expect(within(screen.getByTestId("session-card-thursday")).queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("session-card-thursday")).getByRole("button", { name: "Open session" })).toBeInTheDocument();
  });

  it("goes back to normal once a read succeeds", () => {
    const { rerender } = renderPanel();
    result = { ...result, isError: false };
    rerender(
      <WeekGridStoreProvider>
        <WeekPanel onReschedule={onReschedule} onSeriesMutated={onSeriesMutated} onSchedule={onSchedule} />
      </WeekGridStoreProvider>
    );
    expect(screen.queryByText(/Can't reach the server|Couldn't load this week/)).not.toBeInTheDocument();
    expect(button("Schedule session")).toBeEnabled();
  });
});

describe("WeekPanel sessions that ended earlier today", () => {
  it("keep the menu but its invite resend, cancel like any session still to change, and still drag", () => {
    renderPanel();
    const card = screen.getByTestId("session-card-early-today");
    expect(card).toHaveAttribute("data-tense", "past");
    expect(card).toHaveAttribute("data-draggable", "true");
    fireEvent.contextMenu(card);
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent?.trim())).toEqual([
      "Open session",
      "Reschedule…",
      "Share link",
      "Cancel session…",
    ]);
  });

  it("leave an earlier day's sessions locked", () => {
    result = { ...result, sessions: [...result.sessions, MONDAY_PAST] };
    renderPanel();
    const card = screen.getByTestId("session-card-monday-past");
    expect(card).toHaveAttribute("data-draggable", "false");
    fireEvent.contextMenu(card);
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent?.trim())).toEqual(["Open session", "Remove session…"]);
  });
});

describe("WeekPanel now line", () => {
  const nowLine = () => screen.getByRole("separator", { name: "Now, 1:45 PM" });

  it("sits in today's column between the session that started and the one still to come", () => {
    renderPanel();
    const today = day("Tuesday, August 18");
    const order = Array.from(today.querySelectorAll('[data-testid^="session-card-"], [role="separator"]')).map(
      (el) => el.getAttribute("data-testid") ?? "now"
    );
    expect(order).toEqual(["session-card-early-today", "now", "session-card-late-today"]);
    expect(within(today).getByRole("separator", { name: "Now, 1:45 PM" })).toHaveTextContent("1:45 PM");
  });

  it("shows only once, and never on another day or week", () => {
    renderPanel();
    expect(screen.getAllByRole("separator", { name: /^Now,/ })).toHaveLength(1);
    expect(within(day("Thursday, August 20")).queryByRole("separator")).not.toBeInTheDocument();
    fireEvent.click(button("Next week"));
    expect(screen.queryByRole("separator", { name: /^Now,/ })).not.toBeInTheDocument();
  });

  it("sits above the dashed box on an empty today", () => {
    result = { ...result, sessions: [THURSDAY] };
    renderPanel();
    expect(within(day("Tuesday, August 18")).getByRole("separator", { name: "Now, 1:45 PM" })).toBeInTheDocument();
  });

  it("shows in today's agenda below 1024px too", () => {
    wide = false;
    renderPanel();
    expect(nowLine()).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thursday, August 20" }));
    expect(screen.queryByRole("separator", { name: /^Now,/ })).not.toBeInTheDocument();
  });
});
