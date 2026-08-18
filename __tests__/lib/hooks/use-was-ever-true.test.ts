import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { useWasEverTrue } from "@/lib/hooks/use-was-ever-true";

describe("useWasEverTrue", () => {
  it("returns the initial value on first render", () => {
    const { result: whenTrue } = renderHook(() => useWasEverTrue(true));
    expect(whenTrue.current).toBe(true);

    const { result: whenFalse } = renderHook(() => useWasEverTrue(false));
    expect(whenFalse.current).toBe(false);
  });

  it("latches to true and stays true after the value goes back to false", () => {
    const { result, rerender } = renderHook(({ v }) => useWasEverTrue(v), {
      initialProps: { v: true },
    });
    expect(result.current).toBe(true);

    rerender({ v: false });
    expect(result.current).toBe(true);
  });

  // This is the property `usePrevious` cannot provide and the one the guard
  // logic depends on: a real sign-out fires several re-renders in a row while
  // the live value stays false (org state, coaching relationship state, etc.
  // each reset separately) -- the latch must survive all of them, not just
  // the first.
  it("stays true across many subsequent renders, not just the one right after the flip", () => {
    const { result, rerender } = renderHook(({ v }) => useWasEverTrue(v), {
      initialProps: { v: true },
    });

    rerender({ v: false });
    rerender({ v: false });
    rerender({ v: false });
    rerender({ v: false });

    expect(result.current).toBe(true);
  });

  it("stays false for a value that was never true", () => {
    const { result, rerender } = renderHook(({ v }) => useWasEverTrue(v), {
      initialProps: { v: false },
    });

    rerender({ v: false });
    rerender({ v: false });

    expect(result.current).toBe(false);
  });
});
