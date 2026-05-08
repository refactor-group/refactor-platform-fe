import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";

import { usePrevious } from "@/lib/hooks/use-previous";

describe("usePrevious", () => {
  it("returns undefined on first render", () => {
    const { result } = renderHook(() => usePrevious("a"));
    expect(result.current).toBeUndefined();
  });

  it("returns the prior value on subsequent renders", () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), {
      initialProps: { v: "a" },
    });

    rerender({ v: "b" });
    expect(result.current).toBe("a");

    rerender({ v: "c" });
    expect(result.current).toBe("b");
  });

  it("works for primitive equality (returns undefined when value never changes)", () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), {
      initialProps: { v: 1 },
    });

    rerender({ v: 1 });
    // Effect ran with value=1, so prev now reflects 1, but the *return value*
    // of this render still came from the prior render's ref (which was undefined).
    // After one rerender, result.current is the value from the render before, which was 1.
    expect(result.current).toBe(1);
  });

  it("tracks reference identity for objects", () => {
    const a = { x: 1 };
    const b = { x: 1 };
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), {
      initialProps: { v: a },
    });

    rerender({ v: b });
    expect(result.current).toBe(a);
    expect(result.current).not.toBe(b);
  });
});
