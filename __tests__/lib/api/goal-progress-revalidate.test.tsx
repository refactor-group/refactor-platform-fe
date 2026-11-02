import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import useSWR, { SWRConfig } from "swr";
import { useRevalidateGoalProgress } from "@/lib/api/goal-progress";
import { siteConfig } from "@/site.config";

const base = siteConfig.env.backendServiceURL;

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

const fetchers = {
  goal: vi.fn(() => Promise.resolve("goal")),
  list: vi.fn(() => Promise.resolve("list")),
  goalItself: vi.fn(() => Promise.resolve("goal-itself")),
};

/** Caches the same key shapes the progress hooks use, counting fetches. */
function useCaches() {
  useSWR(`${base}/goals/goal-1/progress`, fetchers.goal);
  useSWR([`${base}/organizations/org-1/coaching_relationships/rel-1/goal_progress?limit=3`, "rel-1|limit=3"], fetchers.list);
  useSWR(`${base}/goals/goal-1`, fetchers.goalItself);
  return useRevalidateGoalProgress();
}

describe("useRevalidateGoalProgress", () => {
  it("refetches a goal's progress and a relationship's progress list, and nothing else", async () => {
    const { result } = renderHook(() => useCaches(), { wrapper });
    await waitFor(() => {
      expect(fetchers.goal).toHaveBeenCalledTimes(1);
      expect(fetchers.list).toHaveBeenCalledTimes(1);
      expect(fetchers.goalItself).toHaveBeenCalledTimes(1);
    });

    await act(() => result.current());

    expect(fetchers.goal).toHaveBeenCalledTimes(2);
    expect(fetchers.list).toHaveBeenCalledTimes(2);
    expect(fetchers.goalItself).toHaveBeenCalledTimes(1);
  });
});
