import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { CoachingSessionInclude } from "@/types/coaching-session";
import { weekOf } from "@/lib/week-grid/week";
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";

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
