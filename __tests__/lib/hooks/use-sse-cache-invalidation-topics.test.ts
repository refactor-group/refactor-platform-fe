import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { siteConfig } from "@/site.config";
import { useSSECacheInvalidation } from "@/lib/hooks/use-sse-cache-invalidation";

const handlers = new Map<string, () => void>();
vi.mock("@/lib/hooks/use-sse-event-handler", () => ({
  useSSEEventHandler: (_source: unknown, event: string, handler: () => void) => {
    handlers.set(event, handler);
  },
}));

const mutate = vi.fn();
vi.mock("swr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("swr")>()),
  useSWRConfig: () => ({ mutate }),
}));

// Every cache key the mutate calls would revalidate, out of the given keys.
function revalidated(keys: unknown[]): unknown[] {
  return keys.filter((key) =>
    mutate.mock.calls.some(([match]) => typeof match === "function" && match(key))
  );
}

describe("topics_changed", () => {
  it("refreshes the session lists that carry topic counts, as well as the topic lists", () => {
    renderHook(() => useSSECacheInvalidation(null));
    mutate.mockClear();
    handlers.get("topics_changed")!();
    const base = siteConfig.env.backendServiceURL;
    const week = [`${base}/users/u-1/coaching_sessions`, { from_date: "2026-08-17", include: "topics" }];
    const topics = `${base}/coaching_sessions/s-1/topics`;
    const actions = `${base}/users/u-1/actions`;
    expect(revalidated([week, topics, actions])).toEqual([week, topics]);
  });
});
