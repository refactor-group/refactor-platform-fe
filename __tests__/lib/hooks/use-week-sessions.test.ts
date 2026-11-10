import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { CoachingSessionInclude } from "@/types/coaching-session";
import { weekOf } from "@/lib/week-grid/week";
import { useAdjacentWeekSessions, useWeekSessions } from "@/lib/hooks/use-week-sessions";

const listForUser = vi.fn();
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useEnrichedCoachingSessionsForUser: (...args: unknown[]) => listForUser(...args),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: { userId: string }) => unknown) => select({ userId: "coach-1" }),
}));

let organizationId: string | null = "org-1";
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: organizationId }),
}));

const TZ = "America/Chicago";
const week = weekOf(0, DateTime.fromISO("2026-08-19T15:00:00Z"), TZ);
const refresh = vi.fn();

beforeEach(() => {
  organizationId = "org-1";
  listForUser.mockReset().mockReturnValue({ enrichedSessions: [], isLoading: false, isError: false, refresh });
});

describe("useAdjacentWeekSessions", () => {
  const byFrom = (results: Record<string, unknown>) =>
    listForUser.mockImplementation((_u: unknown, from: DateTime) => ({
      enrichedSessions: [],
      isLoading: false,
      isError: false,
      refresh,
      ...((results[from.toISODate() ?? ""] as object) ?? {}),
    }));

  it("hands back both neighbours' sessions and the span they cover once loaded", () => {
    byFrom({ "2026-08-10": { enrichedSessions: [{ id: "before" }] }, "2026-08-24": { enrichedSessions: [{ id: "after" }] } });
    const { result } = renderHook(() => useAdjacentWeekSessions(week));
    expect(result.current.sessions.map((s) => s.id).sort()).toEqual(["after", "before"]);
    expect(result.current.known.from.toISODate()).toBe("2026-08-10");
    expect(result.current.known.to.toISODate()).toBe("2026-08-31");
  });

  it("covers only the shown week's side of a neighbour still loading or failed", () => {
    byFrom({ "2026-08-10": { isLoading: true }, "2026-08-24": { isError: true } });
    const { result } = renderHook(() => useAdjacentWeekSessions(week));
    expect(result.current.known.from.toISODate()).toBe("2026-08-17");
    expect(result.current.known.to.toISODate()).toBe("2026-08-24");
  });

  it("asks for the weeks either side, with the same query as showing them", () => {
    renderHook(() => useAdjacentWeekSessions(week));
    const ranges = listForUser.mock.calls.map(([, from, to]) => [(from as DateTime).toISODate(), (to as DateTime).toISODate()]);
    expect(ranges).toEqual(
      expect.arrayContaining([
        ["2026-08-10", "2026-08-16"],
        ["2026-08-24", "2026-08-30"],
      ])
    );
    expect(ranges).toHaveLength(2);
    renderHook(() => useWeekSessions(weekOf(1, DateTime.fromISO("2026-08-19T15:00:00Z"), TZ)));
    const shown = listForUser.mock.calls.at(-1)!.slice(3);
    const ahead = listForUser.mock.calls.find(([, from]) => (from as DateTime).toISODate() === "2026-08-24")!.slice(3);
    expect(ahead).toEqual(shown);
  });
});

describe("useWeekSessions", () => {
  it("asks for Monday through Sunday in the week's zone and organization", () => {
    renderHook(() => useWeekSessions(week));
    const [userId, from, to, include, sortBy, sortOrder, relationshipId, tz, org] = listForUser.mock.calls[0];
    expect(userId).toBe("coach-1");
    expect((from as DateTime).toISODate()).toBe("2026-08-17");
    expect((to as DateTime).toISODate()).toBe("2026-08-23");
    expect(include).toEqual(
      expect.arrayContaining([
        CoachingSessionInclude.Relationship,
        CoachingSessionInclude.Series,
        CoachingSessionInclude.Topics,
      ])
    );
    expect([sortBy, sortOrder]).toEqual(["date", "asc"]);
    expect(relationshipId).toBeUndefined();
    expect(tz).toBe(TZ);
    expect(org).toBe("org-1");
  });

  it("waits for the organization before fetching", () => {
    organizationId = null;
    renderHook(() => useWeekSessions(week));
    expect(listForUser.mock.calls[0][0]).toBeNull();
  });

  it("passes the list, state and refresh through", () => {
    const sessions = [{ id: "s-1" }];
    listForUser.mockReturnValue({ enrichedSessions: sessions, isLoading: true, isError: true, refresh });
    const { result } = renderHook(() => useWeekSessions(week));
    expect(result.current).toEqual({ sessions, isLoading: true, isError: true, refresh });
  });
});
