import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { SWRConfig } from "swr";
import { server } from "@/test-utils/msw-server";
import {
  CoachingSessionApi,
  CoachingSessionInclude,
  type NearestQuery,
  useNearestCoachingSessions,
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

const QUERY: NearestQuery = {
  userId: "user-1",
  relationshipId: "rel-1",
  around: "2026-10-30T14:00:00",
  before: 2,
  after: 3,
};

const SESSION = {
  id: "s1",
  coaching_relationship_id: "rel-1",
  date: "2026-10-30T14:00:00",
  duration_minutes: 60,
  title: null,
  coaching_session_series_id: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

function serveNearest() {
  const urls: URL[] = [];
  server.use(
    http.get("*/users/:id/coaching_sessions/nearest", ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({ status_code: 200, data: [SESSION] });
    })
  );
  return urls;
}

describe("nearest coaching sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listNearestForUser sends the exact path and params", async () => {
    const urls = serveNearest();
    const sessions = await CoachingSessionApi.listNearestForUser("user-1", {
      ...QUERY,
      include: [CoachingSessionInclude.Relationship],
    });

    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toBe("/users/user-1/coaching_sessions/nearest");
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({
      coaching_relationship_id: "rel-1",
      around: "2026-10-30T14:00:00",
      before: "2",
      after: "3",
      include: "relationship",
    });
    expect(sessions.map((s) => s.id)).toEqual(["s1"]);
  });

  it("omits include when none is asked for", async () => {
    const urls = serveNearest();
    await CoachingSessionApi.listNearestForUser("user-1", QUERY);
    expect(urls[0].searchParams.has("include")).toBe(false);
  });

  it("the hook fetches for Some and refetches when the anchor changes", async () => {
    const urls = serveNearest();
    const { result, rerender } = renderHook(
      ({ around }: { around: string }) => useNearestCoachingSessions(Some({ ...QUERY, around })),
      { wrapper, initialProps: { around: QUERY.around } }
    );

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    rerender({ around: "2026-10-30T19:00:00Z" });

    await waitFor(() => expect(urls).toHaveLength(2));
    expect(urls[1].searchParams.get("around")).toBe("2026-10-30T19:00:00Z");
  });

  it("the hook makes no request for None", async () => {
    const urls = serveNearest();
    const { result } = renderHook(() => useNearestCoachingSessions(None), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(urls).toHaveLength(0);
    expect(result.current.sessions).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
