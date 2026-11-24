import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWeekSlide, WeekSlide } from "@/lib/hooks/use-week-slide";
import { None, Some } from "@/types/option";

describe("useWeekSlide", () => {
  it("doesn't slide the first week shown", () => {
    const { result } = renderHook(() => useWeekSlide(3));
    expect(result.current).toEqual(None);
  });

  it("enters from the right when moving later and from the left when moving earlier", () => {
    const { result, rerender } = renderHook(({ offset }) => useWeekSlide(offset), { initialProps: { offset: 0 } });
    rerender({ offset: 1 });
    expect(result.current).toEqual(Some(WeekSlide.FromRight));
    rerender({ offset: -12 });
    expect(result.current).toEqual(Some(WeekSlide.FromLeft));
  });

  it("keeps the slide across re-renders of the same week", () => {
    const { result, rerender } = renderHook(({ offset }) => useWeekSlide(offset), { initialProps: { offset: 0 } });
    rerender({ offset: -1 });
    rerender({ offset: -1 });
    expect(result.current).toEqual(Some(WeekSlide.FromLeft));
  });
});
