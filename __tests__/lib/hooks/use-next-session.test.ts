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
vi.mock("@/lib/hooks/use-now", () => ({ useNow: () => NOW }));
vi.mock("@/lib/hooks/use-user-timezone", () => ({ useUserTimezone: () => TZ }));

const selectNext = vi.fn();
vi.mock("@/lib/utils/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/utils/session")>()),
  selectNextUpcomingSession: (...args: unknown[]) => selectNext(...args),
}));

const session = { id: "sess-1" };
const sessions = [session];
const refresh = vi.fn();

beforeEach(() => {
  selectNext.mockReset();
  weekSessions.mockReset().mockReturnValue({ sessions, isLoading: false, isError: false, refresh });
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
    expect(selectNext).toHaveBeenCalledWith(sessions);
    expect(result.current.session).toEqual(Some(session));
  });

  it("gives None when no session is upcoming", () => {
    selectNext.mockReturnValue(undefined);
    const { result } = renderHook(() => useNextSession());
    expect(result.current.session).toEqual(None);
  });

  it("passes loading, error and refresh through", () => {
    weekSessions.mockReturnValue({ sessions: [], isLoading: true, isError: true, refresh });
    const { result } = renderHook(() => useNextSession());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.refresh).toBe(refresh);
  });

  it("returns now in the user's zone", () => {
    const { result } = renderHook(() => useNextSession());
    expect(result.current.now.zoneName).toBe(TZ);
    expect(result.current.now.toMillis()).toBe(NOW.toMillis());
  });
});
