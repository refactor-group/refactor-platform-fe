import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import type { NearestEachQuery } from "@/lib/api/coaching-sessions";
import type { Option } from "@/types/option";
import { weekOf } from "@/lib/week-grid/week";
import { useWeekEdges } from "@/lib/hooks/use-week-edges";
import { createMockEnrichedSession, createMockRelationship } from "../../test-utils";

interface NearestResult {
  sessions: ReturnType<typeof createMockEnrichedSession>[];
  isLoading: boolean;
  isError: boolean;
}
const queries: Option<NearestEachQuery>[] = [];
let byAround: Record<string, NearestResult> = {};
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useNearestEachCoachingSessions: (query: Option<NearestEachQuery>) => {
    queries.push(query);
    const empty = { sessions: [], isLoading: false, isError: false };
    return query.some ? (byAround[query.val.around] ?? empty) : empty;
  },
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: { userId: string }) => unknown) => select({ userId: "user-1" }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
const relationships = [
  createMockRelationship({ id: "rel-1" }),
  createMockRelationship({ id: "rel-2", coach_id: "user-3", coachee_id: "user-1" }),
  createMockRelationship({ id: "rel-other", coach_id: "user-8", coachee_id: "user-9" }),
];
let relationshipsState = { isLoading: false, isError: false };
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: relationshipsState.isLoading || relationshipsState.isError ? [] : relationships,
    ...relationshipsState,
  }),
}));

const TZ = "America/Chicago";
const week = weekOf(0, DateTime.fromISO("2026-08-19T12:00:00", { zone: TZ }), TZ);
const MONDAY = "2026-08-17T05:00:00Z";
const NEXT_MONDAY = "2026-08-24T05:00:00Z";
const at = (utc: string) => createMockEnrichedSession({ date: utc });

beforeEach(() => {
  relationshipsState = { isLoading: false, isError: false };
  queries.length = 0;
  byAround = {};
});

describe("useWeekEdges", () => {
  it("asks around this Monday and next Monday for every relationship the viewer is in", () => {
    renderHook(() => useWeekEdges(week));
    const arounds = queries.filter((q) => q.some).map((q) => q.some && q.val.around);
    expect(arounds.sort()).toEqual([MONDAY, NEXT_MONDAY]);
    for (const q of queries) {
      if (q.none) continue;
      expect(q.val.userId).toBe("user-1");
      expect([...q.val.relationshipIds].sort()).toEqual(["rel-1", "rel-2"]);
    }
  });

  it("reports what lies either side of the week", () => {
    byAround = {
      [MONDAY]: { sessions: [at("2026-08-10T15:00:00")], isLoading: false, isError: false },
      [NEXT_MONDAY]: { sessions: [], isLoading: false, isError: false },
    };
    const { result } = renderHook(() => useWeekEdges(week));
    expect(result.current).toEqual({ hasEarlier: true, hasLater: false });
  });

  it("leaves both arrows usable while a read is loading or failed", () => {
    byAround = {
      [MONDAY]: { sessions: [], isLoading: true, isError: false },
      [NEXT_MONDAY]: { sessions: [], isLoading: false, isError: true },
    };
    const { result } = renderHook(() => useWeekEdges(week));
    expect(result.current).toEqual({ hasEarlier: true, hasLater: true });
  });

  it("leaves both arrows usable while relationships load", () => {
    relationshipsState = { isLoading: true, isError: false };
    const { result } = renderHook(() => useWeekEdges(week));
    expect(result.current).toEqual({ hasEarlier: true, hasLater: true });
  });

  it("leaves both arrows usable when relationships fail to load", () => {
    relationshipsState = { isLoading: false, isError: true };
    const { result } = renderHook(() => useWeekEdges(week));
    expect(result.current).toEqual({ hasEarlier: true, hasLater: true });
  });
});
