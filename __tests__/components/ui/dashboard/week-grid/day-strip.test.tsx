import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { weekOf, type DayGroup } from "@/lib/week-grid/week";
import type { GridCard } from "@/lib/week-grid/card";
import { DayStrip } from "@/components/ui/dashboard/week-grid/day-strip";

const TZ = "America/Chicago";
const NOW = DateTime.fromISO("2026-08-19T10:00:00", { zone: TZ });
const week = weekOf(0, NOW, TZ);
const card = {} as GridCard;
const days: DayGroup<GridCard>[] = week.days.map((day, i) => ({
  day,
  isToday: i === 2,
  isPast: i < 2,
  items: i === 1 || i === 4 ? [card] : [],
}));

function renderStrip(selected = week.days[2]) {
  const onSelect = vi.fn();
  render(<DayStrip days={days} selected={selected} onSelect={onSelect} />);
  return onSelect;
}

describe("DayStrip", () => {
  it("shows a pill per day, Monday first, named in full", () => {
    renderStrip();
    const pills = screen.getAllByRole("button");
    expect(pills).toHaveLength(7);
    expect(pills[0]).toHaveAccessibleName("Monday, August 17");
    expect(pills[6]).toHaveAccessibleName("Sunday, August 23");
    expect(pills[0]).toHaveTextContent("M");
    expect(pills[0]).toHaveTextContent("17");
  });

  it("marks the selected day and the days with sessions", () => {
    renderStrip();
    const pills = screen.getAllByRole("button");
    expect(pills.map((p) => p.getAttribute("aria-pressed"))).toEqual([
      "false", "false", "true", "false", "false", "false", "false",
    ]);
    expect(pills.map((p) => p.dataset.hasSessions)).toEqual([
      "false", "true", "false", "false", "true", "false", "false",
    ]);
    expect(pills[2]).toHaveAttribute("aria-current", "date");
  });

  it("selects a tapped day", () => {
    const onSelect = renderStrip();
    fireEvent.click(screen.getByRole("button", { name: "Friday, August 21" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].toISODate()).toBe("2026-08-21");
  });
});
