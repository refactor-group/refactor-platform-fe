import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { SWRConfig } from "swr";
import { server } from "@/test-utils/msw-server";
import {
  CoachingSessionApi,
  CoachingSessionInclude,
  useNearestCoachingSessions,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { None, Some } from "@/types/option";

vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
      backendApiVersion: "1.0.0-test",
    },
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const AROUND = "2026-10-30T14:00:00";

/** One session per requested relationship, so each response names what it was asked for. */
function sessionFor(relationshipId: string) {
  return {
    id: `s-${relationshipId}`,
    coaching_relationship_id: relationshipId,
    date: AROUND,
    duration_minutes: 60,
    title: null,
    coaching_session_series_id: null,
    ical_recurrence_id: null,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
}

function serveNearest(fail: (ids: string[]) => boolean = () => false) {
  const urls: URL[] = [];
  server.use(
    http.get("*/users/:id/coaching_sessions/nearest", ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      const ids = (url.searchParams.get("coaching_relationship_ids") ?? "").split(",").filter(Boolean);
      if (fail(ids)) return HttpResponse.json({ status_code: 500 }, { status: 500 });
      return HttpResponse.json({ status_code: 200, data: ids.map(sessionFor) });
    })
  );
  return urls;
}

const idsOf = (url: URL) => url.searchParams.get("coaching_relationship_ids")?.split(",") ?? [];
const relationships = (count: number) => Array.from({ length: count }, (_, i) => `rel-${i + 1}`);

describe("listNearestForUser: batched relationship ids", () => {
  it("sends the ids as one comma-separated list and never the single-id param", async () => {
    const urls = serveNearest();
    const result = await CoachingSessionApi.listNearestForUser("user-1", {
      relationshipIds: ["rel-1", "rel-2"],
      around: AROUND,
      before: 2,
      after: 3,
      include: [CoachingSessionInclude.Relationship],
    });
    if (result.isErr()) throw result.error;

    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toBe("/users/user-1/coaching_sessions/nearest");
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({
      coaching_relationship_ids: "rel-1,rel-2",
      around: AROUND,
      before: "2",
      after: "3",
      include: "relationship",
    });
    expect(result.value.map((s) => s.id)).toEqual(["s-rel-1", "s-rel-2"]);
  });
});

describe("useNearestCoachingSessions: one relationship", () => {
  it("asks with a one-id list", async () => {
    const urls = serveNearest();
    const { result } = renderHook(
      () =>
        useNearestCoachingSessions(
          Some({ userId: "user-1", relationshipIds: ["rel-1"], around: AROUND, before: 2, after: 3, fetchedFor: "a" })
        ),
      { wrapper }
    );
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    expect(urls[0].searchParams.get("coaching_relationship_ids")).toBe("rel-1");
    expect(urls[0].searchParams.has("coaching_relationship_id")).toBe(false);
  });
});

describe("useNearestEachCoachingSessions: one request per 50 relationships", () => {
  const query = (ids: string[]) =>
    Some({ userId: "user-1", relationshipIds: ids, around: AROUND, fetchedFor: `open-${ids.length}` });

  it("sends every relationship in one request, one session either side of now", async () => {
    const urls = serveNearest();
    const { result } = renderHook(() => useNearestEachCoachingSessions(query(["rel-1", "rel-2", "rel-3"])), {
      wrapper,
    });
    await waitFor(() => expect(result.current.sessions).toHaveLength(3));
    expect(urls).toHaveLength(1);
    expect(idsOf(urls[0])).toEqual(["rel-1", "rel-2", "rel-3"]);
    expect(urls[0].searchParams.get("before")).toBe("1");
    expect(urls[0].searchParams.get("after")).toBe("1");
    expect(urls[0].searchParams.has("coaching_relationship_id")).toBe(false);
  });

  it("splits more than 50 relationships into groups of 50 and merges the results", async () => {
    const urls = serveNearest();
    const ids = relationships(51);
    const { result } = renderHook(() => useNearestEachCoachingSessions(query(ids)), { wrapper });
    await waitFor(() => expect(result.current.sessions).toHaveLength(51));
    expect(urls).toHaveLength(2);
    const sent = urls.map(idsOf).sort((a, b) => b.length - a.length);
    expect(sent[0]).toEqual(ids.slice(0, 50));
    expect(sent[1]).toEqual(ids.slice(50));
    expect(new Set(result.current.sessions.map((s) => s.coaching_relationship_id))).toEqual(new Set(ids));
  });

  it("fails as a whole when any group fails", async () => {
    serveNearest((ids) => ids.includes("rel-51"));
    const { result } = renderHook(() => useNearestEachCoachingSessions(query(relationships(51))), { wrapper });
    await waitFor(() => expect(result.current.isError).toBeTruthy());
    expect(result.current.sessions).toEqual([]);
  });

  it("makes no request for None or for no relationships", async () => {
    const urls = serveNearest();
    const none = renderHook(() => useNearestEachCoachingSessions(None), { wrapper });
    const empty = renderHook(() => useNearestEachCoachingSessions(query([])), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(urls).toHaveLength(0);
    expect(none.result.current.sessions).toEqual([]);
    expect(empty.result.current.sessions).toEqual([]);
    expect(none.result.current.isLoading).toBe(false);
    expect(empty.result.current.isLoading).toBe(false);
  });
});
