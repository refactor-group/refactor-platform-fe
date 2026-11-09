import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { None, Some, type Option } from "@/types/option";
import type { NearestQuery } from "@/lib/api/coaching-sessions";
import { PersonGroup } from "@/lib/week-grid/filter";
import { useWeekFilter } from "@/lib/hooks/use-week-filter";
import { WeekGridStoreProvider } from "@/lib/providers/week-grid-store-provider";
import { createMockEnrichedSession, createMockRelationship } from "../../test-utils";

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ userId: "coach-1", userSession: { id: "coach-1", timezone: "America/Chicago" } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/hooks/use-schedule-data", () => ({ useScheduleTimezone: () => "America/Chicago" }));

const relationships = [
  createMockRelationship({ id: "rel-alex", coach_id: "coach-1", coachee_id: "u-alex", coachee_first_name: "Alex", coachee_last_name: "Chen" }),
  createMockRelationship({ id: "rel-erin", coach_id: "coach-1", coachee_id: "u-erin", coachee_first_name: "Erin", coachee_last_name: "Park" }),
  createMockRelationship({ id: "rel-mine", coach_id: "u-boss", coachee_id: "coach-1", coach_first_name: "Bo", coach_last_name: "Ss" }),
];
let relationshipsLoading = false;
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: relationshipsLoading ? [] : relationships,
    isLoading: relationshipsLoading,
    isError: false,
  }),
}));

let nearest = { sessions: [] as ReturnType<typeof createMockEnrichedSession>[], isLoading: false, isError: false };
const nearestQueries: Option<NearestQuery>[] = [];
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useNearestEachCoachingSessions: (query: Option<NearestQuery>) => {
    nearestQueries.push(query);
    return query.some ? nearest : { sessions: [], isLoading: false, isError: false };
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => <WeekGridStoreProvider>{children}</WeekGridStoreProvider>;
const setup = () => renderHook(() => useWeekFilter(), { wrapper });
const lastQuery = () => nearestQueries[nearestQueries.length - 1];

beforeEach(() => {
  sessionStorage.clear();
  nearestQueries.length = 0;
  relationshipsLoading = false;
  const soon = DateTime.now().plus({ days: 2 }).toUTC().toFormat("yyyy-LL-dd'T'HH:mm:ss");
  nearest = {
    sessions: [createMockEnrichedSession({ coaching_relationship_id: "rel-alex", date: soon })],
    isLoading: false,
    isError: false,
  };
});

describe("useWeekFilter", () => {
  it("doesn't ask for activity until the filter first opens", () => {
    const { result } = setup();
    expect(nearestQueries.length).toBeGreaterThan(0);
    expect(nearestQueries.every((q) => q.none)).toBe(true);
    expect(result.current.grouped).toBe(false);
  });

  it("asks once, around the first open, and keeps that answer on later opens", () => {
    const { result } = setup();
    act(() => result.current.load());
    const first = lastQuery();
    expect(first.some && first.val.relationshipIds).toEqual(["rel-alex", "rel-erin"]);
    act(() => result.current.load());
    expect(lastQuery()).toEqual(first);
  });

  it("offers only the people the viewer coaches, grouped by activity once loaded", () => {
    const { result } = setup();
    act(() => result.current.load());
    expect(result.current.grouped).toBe(true);
    expect(result.current.people.map((p) => [p.fullName, p.group])).toEqual([
      ["Alex Chen", PersonGroup.Coachees],
      ["Erin Park", PersonGroup.Inactive],
    ]);
  });

  it("isn't grouped while activity loads", () => {
    nearest = { sessions: [], isLoading: true, isError: false };
    const { result } = setup();
    act(() => result.current.load());
    expect(result.current.grouped).toBe(false);
  });

  it("falls back to everyone under Coachees when activity fails", () => {
    nearest = { sessions: [], isLoading: false, isError: true };
    const { result } = setup();
    act(() => result.current.load());
    expect(result.current.grouped).toBe(true);
    expect(result.current.people.every((p) => p.group === PersonGroup.Coachees)).toBe(true);
  });

  it("selects and clears a person", () => {
    const { result } = setup();
    act(() => result.current.select("u-erin"));
    expect(result.current.selected.some && result.current.selected.val.fullName).toBe("Erin Park");
    act(() => result.current.clear());
    expect(result.current.selected).toEqual(None);
  });

  it("drops a saved filter for someone the viewer no longer coaches", () => {
    sessionStorage.setItem(
      "week-grid-store",
      JSON.stringify({ state: { personFilter: Some("u-gone") }, version: 0 })
    );
    const { result } = setup();
    expect(result.current.selected).toEqual(None);
  });

  it("keeps a saved filter while relationships are still loading", () => {
    relationshipsLoading = true;
    const { result, rerender } = setup();
    act(() => result.current.select("u-alex"));
    rerender();
    relationshipsLoading = false;
    rerender();
    expect(result.current.selected.some && result.current.selected.val.userId).toBe("u-alex");
  });
});
