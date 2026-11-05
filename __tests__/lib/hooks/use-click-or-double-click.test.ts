import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOUBLE_CLICK_WINDOW_MS, useClickOrDoubleClick } from "@/lib/hooks/use-click-or-double-click";

const onClick = vi.fn();
const onDoubleClick = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

const setup = () => renderHook(() => useClickOrDoubleClick(onClick, onDoubleClick));

describe("useClickOrDoubleClick", () => {
  it("waits out the double-click window before a single click", () => {
    const { result } = setup();
    act(() => result.current.onClick());
    act(() => vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW_MS - 1));
    expect(onClick).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("uses the prototype's 260ms window", () => {
    expect(DOUBLE_CLICK_WINDOW_MS).toBe(260);
  });

  it("runs only the double-click when both clicks of a double-click arrive", () => {
    const { result } = setup();
    act(() => {
      result.current.onClick();
      result.current.onClick();
      result.current.onDoubleClick();
    });
    act(() => vi.advanceTimersByTime(1000));
    expect(onClick).not.toHaveBeenCalled();
    expect(onDoubleClick).toHaveBeenCalledTimes(1);
  });

  it("drops a pending click on unmount", () => {
    const { result, unmount } = setup();
    act(() => result.current.onClick());
    unmount();
    act(() => vi.advanceTimersByTime(1000));
    expect(onClick).not.toHaveBeenCalled();
  });
});
