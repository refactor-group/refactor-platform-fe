import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNow } from "@/lib/hooks/use-now";

const START = new Date("2026-11-05T15:00:00Z");

describe("useNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the current time on mount", () => {
    const { result } = renderHook(() => useNow(30_000));
    expect(result.current.toMillis()).toBe(START.getTime());
  });

  it("moves forward once per interval and not before", () => {
    const { result } = renderHook(() => useNow(30_000));
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(result.current.toMillis()).toBe(START.getTime());
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toMillis()).toBe(START.getTime() + 30_000);
  });

  it("stops ticking after unmount", () => {
    const { unmount } = renderHook(() => useNow(30_000));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
