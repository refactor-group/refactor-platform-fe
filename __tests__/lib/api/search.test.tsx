import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AxiosError, type AxiosRequestConfig } from "axios";
import { EntityApi } from "@/lib/api/entity-api";
import { EntityApiError } from "@/types/entity-api-error";
import {
  SEARCH_CACHE_TTL_MS,
  SearchApi,
  buildSearchQuery,
  clearSearchCache,
  toSearchError,
  useSearch,
} from "@/lib/api/search";
import { logoutCleanupRegistry } from "@/lib/hooks/logout-cleanup-registry";
import { SearchErrorCode, SearchableType } from "@/types/search";
import { Some } from "@/types/option";

vi.mock("@/lib/api/entity-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/entity-api")>();
  return { ...actual, EntityApi: { getFn: vi.fn() } };
});

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const goalHit = (id: string) => ({
  type: "goal",
  id,
  score: 0.5,
  title: `Goal ${id}`,
  snippet: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  organization_id: "org-1",
  coaching_relationship_id: "rel-1",
  status: "InProgress",
  created_in_session_id: null,
});

const httpError = (status: number, data?: unknown): EntityApiError =>
  new EntityApiError(
    "get",
    "http://localhost:3000/search",
    new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
      status,
      statusText: "",
      headers: {},
      config: {} as never,
      data,
    })
  );

describe("buildSearchQuery", () => {
  it("serializes only defined params and joins types with commas", () => {
    const qs = buildSearchQuery({
      q: "plan",
      types: [SearchableType.Goals, SearchableType.Actions],
      limit: 10,
      organization_id: undefined,
    });
    expect(qs.get("q")).toBe("plan");
    expect(qs.get("types")).toBe("goals,actions");
    expect(qs.get("limit")).toBe("10");
    expect(qs.has("organization_id")).toBe(false);
  });

  it("truncates the query at the backend's limit", () => {
    const qs = buildSearchQuery({ q: "x".repeat(300) });
    expect(qs.get("q")).toHaveLength(256);
  });
});

describe("toSearchError", () => {
  it("maps structured 400 bodies to validation errors", () => {
    expect(
      toSearchError(httpError(400, { error: "malformed_cursor", message: "bad cursor" }))
    ).toEqual({ kind: "validation", code: SearchErrorCode.MalformedCursor, message: "bad cursor" });
  });

  it("maps 429 and 503", () => {
    expect(toSearchError(httpError(429))).toEqual({ kind: "rate_limited" });
    expect(toSearchError(httpError(503))).toEqual({ kind: "unavailable" });
  });

  it("maps network failures", () => {
    const error = new EntityApiError(
      "get",
      "http://localhost:3000/search",
      new AxiosError("Network Error", "ERR_NETWORK")
    );
    expect(toSearchError(error)).toEqual({ kind: "network" });
  });

  it("falls back to unknown for anything else", () => {
    expect(toSearchError(new Error("boom"))).toEqual({ kind: "unknown", message: "boom" });
    expect(toSearchError(httpError(400, { error: "not_a_code" })).kind).toBe("unknown");
  });
});

describe("SearchApi.search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the search endpoint with the encoded query and passes the abort signal", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "weekly plan", limit: 25, hits: [], next_cursor: null });
    const controller = new AbortController();

    const result = await SearchApi.search({ q: "weekly plan" }, controller.signal);

    expect(result.isOk()).toBe(true);
    const [url, config] = vi.mocked(EntityApi.getFn).mock.calls[0] as [string, AxiosRequestConfig];
    expect(url).toBe("http://localhost:3000/search?q=weekly+plan");
    expect(config.signal).toBe(controller.signal);
  });
});

describe("useSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    clearSearchCache();
  });
  afterEach(() => vi.useRealTimers());

  it("stays idle without a request for queries under two characters", () => {
    const { result } = renderHook(() => useSearch("a", {}, 0));
    act(() => vi.advanceTimersByTime(10));
    expect(result.current.state).toEqual({ kind: "idle" });
    expect(EntityApi.getFn).not.toHaveBeenCalled();
  });

  it("debounces: only the last query within the window is sent", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [goalHit("g1")], next_cursor: null });
    const { result, rerender } = renderHook(({ q }) => useSearch(q, {}, 250), {
      initialProps: { q: "pl" },
    });
    expect(result.current.state).toEqual({ kind: "loading", query: "pl" });

    rerender({ q: "pla" });
    act(() => vi.advanceTimersByTime(100));
    rerender({ q: "plan" });
    act(() => vi.advanceTimersByTime(250));

    expect(EntityApi.getFn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(EntityApi.getFn).mock.calls[0][0]).toContain("q=plan");

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.kind).toBe("loaded");
    if (result.current.state.kind === "loaded") {
      expect(result.current.state.hits.map((h) => h.id)).toEqual(["g1"]);
    }
  });

  it("aborts the in-flight request when the query changes", async () => {
    vi.mocked(EntityApi.getFn).mockImplementation(
      (_url: string, config?: AxiosRequestConfig) =>
        new Promise((_resolve, reject) => {
          config?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );
    const { rerender } = renderHook(({ q }) => useSearch(q, {}, 0), {
      initialProps: { q: "first" },
    });
    act(() => vi.advanceTimersByTime(1));
    const firstSignal = (vi.mocked(EntityApi.getFn).mock.calls[0][1] as AxiosRequestConfig).signal;

    rerender({ q: "second" });
    act(() => vi.advanceTimersByTime(1));

    expect(firstSignal?.aborted).toBe(true);
    expect(EntityApi.getFn).toHaveBeenCalledTimes(2);
  });

  it("surfaces typed errors", async () => {
    vi.mocked(EntityApi.getFn).mockRejectedValue(httpError(429));
    const { result } = renderHook(() => useSearch("plan", {}, 0));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.state).toEqual({
      kind: "error",
      query: "plan",
      error: { kind: "rate_limited" },
    });
  });

  it("loadMore appends the next page using the cursor", async () => {
    vi.mocked(EntityApi.getFn)
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g1")], next_cursor: "CUR" })
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g2")], next_cursor: null });
    const { result } = renderHook(() => useSearch("plan", {}, 0));

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.kind).toBe("loaded");

    act(() => result.current.loadMore());
    expect(result.current.state).toMatchObject({ kind: "loaded", isLoadingMore: true });
    expect(vi.mocked(EntityApi.getFn).mock.calls[1][0]).toContain("cursor=CUR");

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.state).toMatchObject({ kind: "loaded", isLoadingMore: false });
    if (result.current.state.kind === "loaded") {
      expect(result.current.state.hits.map((h) => h.id)).toEqual(["g1", "g2"]);
      expect(result.current.state.nextCursor.none).toBe(true);
    }
  });

  it("a failed later page keeps loaded hits and the cursor, and loadMore retries it", async () => {
    vi.mocked(EntityApi.getFn)
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g1")], next_cursor: "CUR" })
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g2")], next_cursor: null });
    const { result } = renderHook(() => useSearch("plan", {}, 0));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    act(() => result.current.loadMore());
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.state).toMatchObject({ kind: "loaded", isLoadingMore: false });
    if (result.current.state.kind === "loaded") {
      expect(result.current.state.hits.map((h) => h.id)).toEqual(["g1"]);
      expect(result.current.state.nextCursor).toEqual(Some("CUR"));
      expect(result.current.state.loadMoreError).toEqual(Some({ kind: "unavailable" }));
    }

    act(() => result.current.loadMore());
    expect(vi.mocked(EntityApi.getFn).mock.calls[2][0]).toContain("cursor=CUR");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    if (result.current.state.kind === "loaded") {
      expect(result.current.state.hits.map((h) => h.id)).toEqual(["g1", "g2"]);
      expect(result.current.state.loadMoreError.none).toBe(true);
    }
  });

  it("a filter change resets to page one", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [], next_cursor: null });
    const { result, rerender } = renderHook(
      ({ types }) => useSearch("plan", { types }, 0),
      { initialProps: { types: [SearchableType.Goals] } }
    );
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.state.kind).toBe("loaded");

    rerender({ types: [SearchableType.Actions] });
    expect(result.current.state).toEqual({ kind: "loading", query: "plan" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(vi.mocked(EntityApi.getFn).mock.calls[1][0]).toContain("types=actions");
  });
});

describe("useSearch result cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
    clearSearchCache();
  });
  afterEach(() => vi.useRealTimers());

  /** Searches `q` to completion so later hooks can hit the cache. */
  async function warm(q: string, filters = {}) {
    const hook = renderHook(() => useSearch(q, filters, 250));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    return hook;
  }

  it("a repeated query renders from the cache with no debounce and no request", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [goalHit("g1")], next_cursor: null });
    const { unmount } = await warm("plan");
    expect(EntityApi.getFn).toHaveBeenCalledTimes(1);
    unmount();

    const { result } = renderHook(() => useSearch("plan", {}, 250));
    expect(result.current.state).toMatchObject({ kind: "loaded", hits: [{ id: "g1" }] });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(EntityApi.getFn).toHaveBeenCalledTimes(1);
  });

  it("backspacing and retyping does not refetch the earlier query", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [goalHit("g1")], next_cursor: null });
    const { result, rerender } = renderHook(({ q }) => useSearch(q, {}, 250), {
      initialProps: { q: "plan" },
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    rerender({ q: "pla" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(EntityApi.getFn).toHaveBeenCalledTimes(2);

    rerender({ q: "plan" });
    expect(result.current.state).toMatchObject({ kind: "loaded", query: "plan" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(EntityApi.getFn).toHaveBeenCalledTimes(2);
  });

  it("an expired entry refetches", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [], next_cursor: null });
    const { unmount } = await warm("plan");
    unmount();

    act(() => vi.advanceTimersByTime(SEARCH_CACHE_TTL_MS + 1));
    const { result } = renderHook(() => useSearch("plan", {}, 250));
    expect(result.current.state).toEqual({ kind: "loading", query: "plan" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(EntityApi.getFn).toHaveBeenCalledTimes(2);
  });

  it("different filters miss, as does a trailing space", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [], next_cursor: null });
    await warm("plan", { types: [SearchableType.Goals] });

    const { result } = renderHook(() => useSearch("plan", { types: [SearchableType.Actions] }, 250));
    expect(result.current.state).toEqual({ kind: "loading", query: "plan" });
    const { result: spaced } = renderHook(() => useSearch("plan ", { types: [SearchableType.Goals] }, 250));
    expect(spaced.current.state).toEqual({ kind: "loading", query: "plan " });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(EntityApi.getFn).toHaveBeenCalledTimes(3);
  });

  it("loadMore from a cached state continues from its cursor and recaches both pages", async () => {
    vi.mocked(EntityApi.getFn)
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g1")], next_cursor: "CUR" })
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g2")], next_cursor: null });
    const { unmount } = await warm("plan");
    unmount();

    const { result } = renderHook(() => useSearch("plan", {}, 250));
    expect(result.current.state).toMatchObject({ kind: "loaded", nextCursor: Some("CUR") });
    act(() => result.current.loadMore());
    expect(result.current.state).toMatchObject({ kind: "loaded", isLoadingMore: true });
    expect(vi.mocked(EntityApi.getFn).mock.calls[1][0]).toContain("cursor=CUR");
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    if (result.current.state.kind === "loaded") {
      expect(result.current.state.hits.map((h) => h.id)).toEqual(["g1", "g2"]);
    }

    const { result: later } = renderHook(() => useSearch("plan", {}, 250));
    expect(later.current.state).toMatchObject({ kind: "loaded", isLoadingMore: false });
    if (later.current.state.kind === "loaded") {
      expect(later.current.state.hits.map((h) => h.id)).toEqual(["g1", "g2"]);
      expect(later.current.state.nextCursor.none).toBe(true);
    }
    expect(EntityApi.getFn).toHaveBeenCalledTimes(2);
  });

  it("a failed later page is not written to the cache", async () => {
    vi.mocked(EntityApi.getFn)
      .mockResolvedValueOnce({ query: "plan", limit: 1, hits: [goalHit("g1")], next_cursor: "CUR" })
      .mockRejectedValueOnce(httpError(503));
    const { result, unmount } = await warm("plan");
    act(() => result.current.loadMore());
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current.state).toMatchObject({ loadMoreError: Some({ kind: "unavailable" }) });
    unmount();

    const { result: again } = renderHook(() => useSearch("plan", {}, 250));
    expect(again.current.state).toMatchObject({
      kind: "loaded",
      nextCursor: Some("CUR"),
      loadMoreError: { none: true },
    });
  });

  it("errors are not cached", async () => {
    vi.mocked(EntityApi.getFn).mockRejectedValue(httpError(429));
    const { unmount } = await warm("plan");
    unmount();

    const { result } = renderHook(() => useSearch("plan", {}, 250));
    expect(result.current.state).toEqual({ kind: "loading", query: "plan" });
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(EntityApi.getFn).toHaveBeenCalledTimes(2);
  });

  it("logout clears the cache", async () => {
    vi.mocked(EntityApi.getFn).mockResolvedValue({ query: "plan", limit: 25, hits: [], next_cursor: null });
    const { unmount } = await warm("plan");
    unmount();

    await logoutCleanupRegistry.executeAll();
    const { result } = renderHook(() => useSearch("plan", {}, 250));
    expect(result.current.state).toEqual({ kind: "loading", query: "plan" });
  });
});
