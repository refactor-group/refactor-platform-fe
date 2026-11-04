import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useHoverIntent } from "@/lib/hooks/use-hover-intent";
import { None, Some } from "@/types/option";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useHoverIntent", () => {
  it("activates a key after the delay", () => {
    const { result } = renderHook(() => useHoverIntent<string>(350));
    act(() => result.current.enter("a"));
    act(() => vi.advanceTimersByTime(349));
    expect(result.current.active).toEqual(None);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.active).toEqual(Some("a"));
  });

  it("clears on leave, before or after the delay", () => {
    const { result } = renderHook(() => useHoverIntent<string>(350));
    act(() => result.current.enter("a"));
    act(() => result.current.leave());
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.active).toEqual(None);
    act(() => result.current.enter("a"));
    act(() => vi.advanceTimersByTime(350));
    act(() => result.current.leave());
    expect(result.current.active).toEqual(None);
  });

  it("only activates the last key entered", () => {
    const { result } = renderHook(() => useHoverIntent<string>(350));
    act(() => result.current.enter("a"));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.enter("b"));
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.active).toEqual(None);
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.active).toEqual(Some("b"));
  });

  it("drops a pending timer on unmount", () => {
    const { result, unmount } = renderHook(() => useHoverIntent<string>(350));
    act(() => result.current.enter("a"));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
