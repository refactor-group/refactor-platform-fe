import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MonthGrid } from "@/components/ui/new-session/month-grid";
import type { BusySession } from "@/lib/scheduling";
import { None } from "@/types/option";
import { EHAB, TODAY, at } from "./fixtures";

const busyAt = (id: string, start: string): BusySession => ({
  ...EHAB,
  id,
  start: at(start),
  end: at(start).plus({ minutes: 50 }),
});

const day = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}(,|$)`) });

function alignOn(name: string): string | null {
  fireEvent.mouseEnter(day(name));
  act(() => vi.advanceTimersByTime(350));
  const align = screen.getByRole("tooltip").getAttribute("data-align");
  fireEvent.mouseLeave(day(name));
  return align;
}

afterEach(() => vi.useRealTimers());

describe("MonthGrid tooltip alignment", () => {
  it("anchors to the cell's edge in the outer two columns, else centers", () => {
    vi.useFakeTimers();
    render(
      <MonthGrid
        month={TODAY}
        today={TODAY}
        selected={None}
        busy={[EHAB, busyAt("wed", "2026-08-19T10:00"), busyAt("sat", "2026-08-22T10:00")]}
        tooltips
        onSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    );
    expect(alignOn("Tuesday, August 18")).toBe("start");
    expect(alignOn("Wednesday, August 19")).toBe("center");
    expect(alignOn("Saturday, August 22")).toBe("end");
  });
});
