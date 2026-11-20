import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { useNextSession } from "@/lib/hooks/use-next-session";
import type { Week } from "@/lib/week-grid/week";
import { None, Some } from "@/types/option";

const weekSessions = vi.fn();
vi.mock("@/lib/hooks/use-week-sessions", () => ({
  useWeekSessions: (week: Week) => weekSessions(week),
}));

const TZ = "America/Chicago";
const NOW = DateTime.fromISO("2026-11-19T12:00:00", { zone: TZ });
const SUNDAY = DateTime.fromISO("2026-11-22T20:00:00", { zone: TZ });
let now = NOW;
vi.mock("@/lib/hooks/use-now", () => ({ useNow: () => now }));
vi.mock("@/lib/hooks/use-user-timezone", () => ({ useUserTimezone: () => TZ }));

const selectNext = vi.fn();
vi.mock("@/lib/utils/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/session")>()),
  selectNextUpcomingSession: (...args: unknown[]) => selectNext(...args),
}));

const session = { id: "sess-1" };
const sessions = [session];
const refresh = vi.fn();
const nextRefresh = vi.fn();

const THIS_MONDAY = "2026-11-16";
const NEXT_MONDAY = "2026-11-23";
const loaded = { isLoading: false, isError: false };
let byWeek: Record<string, object>;

const mondaySession = { id: "mon", date: "2026-11-23T15:00:00" }; // 09:00 Chicago
const tuesdaySession = { id: "tue", date: "2026-11-24T15:00:00" };

function candidates(): unknown[] {
  return selectNext.mock.calls[0][0];
}

beforeEach(() => {
  now = NOW;
  selectNext.mockReset();
  refresh.mockReset();
  nextRefresh.mockReset();
  byWeek = {
    [THIS_MONDAY]: { sessions, ...loaded, refresh },
    [NEXT_MONDAY]: { sessions: [], ...loaded, refresh: nextRefresh },
  };
  weekSessions.mockReset().mockImplementation((week: Week) => byWeek[week.days[0].toISODate()!]);
});

describe("useNextSession", () => {
  it("reads the current week, Monday through Sunday in the user's zone", () => {
    renderHook(() => useNextSession());
    const week: Week = weekSessions.mock.calls[0][0];
    expect(week.days[0].toISODate()).toBe("2026-11-16");
    expect(week.days[6].toISODate()).toBe("2026-11-22");
    expect(week.days[0].zoneName).toBe(TZ);
    expect(week.days[6].zoneName).toBe(TZ);
  });

  it("wraps the selected session in Some", () => {
    selectNext.mockReturnValue(session);
    const { result } = renderHook(() => useNextSession());
    expect(selectNext).toHaveBeenCalledWith(sessions, NOW);
    expect(result.current.session).toEqual(Some(session));
  });

  it("gives None when no session is upcoming", () => {
    selectNext.mockReturnValue(undefined);
    const { result } = renderHook(() => useNextSession());
    expect(result.current.session).toEqual(None);
  });

  it("passes loading, error and refresh through", () => {
    byWeek[THIS_MONDAY] = { sessions: [], isLoading: true, isError: true, refresh };
    const { result } = renderHook(() => useNextSession());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(true);
    result.current.refresh();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("returns now in the user's zone", () => {
    const { result } = renderHook(() => useNextSession());
    expect(result.current.now.zoneName).toBe(TZ);
    expect(result.current.now.toMillis()).toBe(NOW.toMillis());
  });

  it("reads the current week and next week", () => {
    renderHook(() => useNextSession());
    const [current, next]: Week[] = weekSessions.mock.calls.map((c) => c[0]);
    expect(current.days[0].toISODate()).toBe("2026-11-16");
    expect(current.days[6].toISODate()).toBe("2026-11-22");
    expect(next.days[0].toISODate()).toBe("2026-11-23");
    expect(next.days[6].toISODate()).toBe("2026-11-29");
  });

  it("on Sunday, includes Monday's session", () => {
    now = SUNDAY;
    byWeek[THIS_MONDAY] = { sessions: [], ...loaded, refresh };
    byWeek[NEXT_MONDAY] = { sessions: [mondaySession], ...loaded, refresh: nextRefresh };
    renderHook(() => useNextSession());
    expect(candidates()).toContain(mondaySession);
  });

  it("on Sunday, leaves out Tuesday's session", () => {
    now = SUNDAY;
    byWeek[THIS_MONDAY] = { sessions: [], ...loaded, refresh };
    byWeek[NEXT_MONDAY] = { sessions: [tuesdaySession], ...loaded, refresh: nextRefresh };
    renderHook(() => useNextSession());
    expect(candidates()).not.toContain(tuesdaySession);
  });

  it("on Thursday, leaves out next Monday's session", () => {
    byWeek[NEXT_MONDAY] = { sessions: [mondaySession], ...loaded, refresh: nextRefresh };
    renderHook(() => useNextSession());
    expect(candidates()).not.toContain(mondaySession);
  });

  it("lets next week's loading and error hold the card only on Sunday", () => {
    byWeek[NEXT_MONDAY] = { sessions: [], isLoading: true, isError: true, refresh: nextRefresh };
    const thursday = renderHook(() => useNextSession()).result.current;
    expect(thursday.isLoading).toBe(false);
    expect(thursday.isError).toBe(false);

    now = SUNDAY;
    const sunday = renderHook(() => useNextSession()).result.current;
    expect(sunday.isLoading).toBe(true);
    expect(sunday.isError).toBe(true);
  });

  it("refreshes both weeks", () => {
    const { result } = renderHook(() => useNextSession());
    result.current.refresh();
    expect(refresh).toHaveBeenCalledOnce();
    expect(nextRefresh).toHaveBeenCalledOnce();
  });
});
