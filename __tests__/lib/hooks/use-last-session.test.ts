import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import type { NearestEachQuery } from "@/lib/api/coaching-sessions";
import { useLastSession } from "@/lib/hooks/use-last-session";
import { PersonGroup, type FilterPerson } from "@/lib/week-grid/filter";
import { None, Some, type Option } from "@/types/option";
import { createMockEnrichedSession, createMockRelationship } from "../../test-utils";

const queries: Option<NearestEachQuery>[] = [];
let nearest = { sessions: [] as ReturnType<typeof createMockEnrichedSession>[], isLoading: false, isError: false };
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useNearestEachCoachingSessions: (query: Option<NearestEachQuery>) => {
    queries.push(query);
    return nearest;
  },
}));
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (select: (s: { userId: string }) => unknown) => select({ userId: "user-1" }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [
      createMockRelationship({ id: "rel-1" }),
      createMockRelationship({ id: "rel-2", coach_id: "user-3", coachee_id: "user-1" }),
    ],
    isLoading: false,
    isError: false,
  }),
}));

const NOW = DateTime.fromISO("2026-08-18T18:45:00Z");
const SAM: FilterPerson = { userId: "u-sam", fullName: "Sam Ruiz", relationshipIds: ["rel-sam"], group: PersonGroup.Active };
const at = (id: string, date: string) => createMockEnrichedSession({ id, date });
const lastQuery = () => {
  const q = queries[queries.length - 1];
  if (q.none) throw new Error("no query");
  return q.val;
};

beforeEach(() => {
  queries.length = 0;
  nearest = { sessions: [], isLoading: false, isError: false };
});

describe("useLastSession", () => {
  it("asks across every relationship the viewer is in, from the top of the hour", () => {
    renderHook(() => useLastSession(None, NOW, true));
    expect([...lastQuery().relationshipIds].sort()).toEqual(["rel-1", "rel-2"]);
    expect(lastQuery().around).toBe("2026-08-18T18:00:00Z");
  });

  it("asks only about the filtered person", () => {
    renderHook(() => useLastSession(Some(SAM), NOW, true));
    expect(lastQuery().relationshipIds).toEqual(["rel-sam"]);
  });

  it("returns the latest session before the hour, not the next one", () => {
    nearest = { ...nearest, sessions: [at("next", "2026-08-20T15:00:00"), at("last", "2026-04-14T15:00:00")] };
    const { result } = renderHook(() => useLastSession(None, NOW, true));
    expect(result.current.some && result.current.val.id).toBe("last");
  });

  it("keeps the previous answer while the next loads, so the link doesn't blink", () => {
    nearest = { sessions: [at("last", "2026-04-14T15:00:00")], isLoading: true, isError: false };
    const { result } = renderHook(() => useLastSession(None, NOW, true));
    expect(result.current.some && result.current.val.id).toBe("last");
  });

  it("ignores kept sessions from outside the filtered person's relationships", () => {
    nearest = {
      sessions: [
        createMockEnrichedSession({ id: "other", date: "2026-08-01T15:00:00", coaching_relationship_id: "rel-1" }),
        createMockEnrichedSession({ id: "sam", date: "2026-04-14T15:00:00", coaching_relationship_id: "rel-sam" }),
      ],
      isLoading: true,
      isError: false,
    };
    const { result } = renderHook(() => useLastSession(Some(SAM), NOW, true));
    expect(result.current.some && result.current.val.id).toBe("sam");
  });

  it("is None when nothing has loaded", () => {
    nearest = { sessions: [], isLoading: true, isError: false };
    expect(renderHook(() => useLastSession(None, NOW, true)).result.current).toEqual(None);
  });
});
