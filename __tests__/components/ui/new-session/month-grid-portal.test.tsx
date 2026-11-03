import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MonthGrid } from "@/components/ui/new-session/month-grid";
import { None } from "@/types/option";
import { EHAB, PRIYA, TODAY } from "./fixtures";

afterEach(() => vi.useRealTimers());

describe("MonthGrid day tooltip", () => {
  it("renders outside the grid, so a scrolling parent can't clip it", () => {
    vi.useFakeTimers();
    render(
      <MonthGrid
        month={TODAY}
        today={TODAY}
        selected={None}
        busy={[EHAB, PRIYA]}
        tooltips
        onSelect={vi.fn()}
        onMonthChange={vi.fn()}
      />
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Tuesday, August 18,/ }));
    act(() => vi.advanceTimersByTime(350));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Ehab Badawi");
    expect(screen.getByTestId("month-grid-days")).not.toContainElement(tip);
  });
});
