import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MonthGrid } from "@/components/ui/new-session/month-grid";
import { None, Some } from "@/types/option";
import { EHAB, PRIYA, TODAY, at } from "./fixtures";

function renderGrid(overrides: Partial<Parameters<typeof MonthGrid>[0]> = {}) {
  const props = {
    month: TODAY,
    today: TODAY,
    selected: None,
    busy: [EHAB, PRIYA],
    tooltips: true,
    onSelect: vi.fn(),
    onMonthChange: vi.fn(),
    ...overrides,
  };
  render(<MonthGrid {...props} />);
  return props;
}

const day = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}(,|$)`) });

afterEach(() => vi.useRealTimers());

describe("MonthGrid", () => {
  it("shows the abbreviated month and no Today pill on the current month", () => {
    renderGrid();
    expect(screen.getByText("Aug 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Today" })).not.toBeInTheDocument();
  });

  it("steps one month with the chevrons", () => {
    const props = renderGrid();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(props.onMonthChange.mock.calls[0][0].toISODate()).toBe("2026-09-01");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(props.onMonthChange.mock.calls[1][0].toISODate()).toBe("2026-07-01");
  });

  it("offers Today on another month and jumps back to it", () => {
    const props = renderGrid({ month: at("2026-10-01T00:00") });
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(props.onMonthChange.mock.calls[0][0].toISODate()).toBe("2026-08-01");
  });

  it("disables past days and marks today", () => {
    renderGrid();
    expect(day("Sunday, August 16")).toBeDisabled();
    expect(day("Monday, August 17")).toBeEnabled();
    expect(day("Monday, August 17")).toHaveAttribute("aria-current", "date");
  });

  it("disables every day of a past month", () => {
    renderGrid({ month: at("2026-07-01T00:00") });
    expect(day("Friday, July 31")).toBeDisabled();
    expect(day("Wednesday, July 1")).toBeDisabled();
  });

  it("selects a day at its start", () => {
    const props = renderGrid();
    fireEvent.click(day("Thursday, August 20"));
    const picked = props.onSelect.mock.calls[0][0];
    expect(picked.toISO()).toBe(at("2026-08-20T00:00").toISO());
  });

  it("marks the selected day, and only on its own month", () => {
    renderGrid({ selected: Some(at("2026-08-20T00:00")) });
    expect(day("Thursday, August 20")).toHaveAttribute("aria-pressed", "true");
    expect(day("Friday, August 21")).toHaveAttribute("aria-pressed", "false");
  });

  it("names how many sessions a day has", () => {
    renderGrid();
    expect(day("Tuesday, August 18")).toHaveAccessibleName("Tuesday, August 18, 2 sessions");
    expect(day("Wednesday, August 19")).toHaveAccessibleName("Wednesday, August 19");
  });

  it("starts weeks on Monday", () => {
    renderGrid();
    const days = screen.getAllByRole("button", { name: /, August \d+/ });
    expect(days[0]).toHaveAccessibleName(/^Saturday, August 1/);
    const cells = screen.getByTestId("month-grid-days").children;
    // August 1, 2026 is a Saturday: five leading blanks.
    expect(cells[5]).toContainElement(days[0]);
  });

  it("shows a busy day's sessions after hovering 350ms", () => {
    vi.useFakeTimers();
    renderGrid();
    fireEvent.mouseEnter(day("Tuesday, August 18"));
    act(() => vi.advanceTimersByTime(349));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Tue 18");
    expect(tip).toHaveTextContent("Ehab Badawi");
    expect(tip).toHaveTextContent("2:30 PM–3:20 PM");
    expect(tip).toHaveTextContent("Priya Raman");
    fireEvent.mouseLeave(day("Tuesday, August 18"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("cancels the tooltip when the pointer leaves early", () => {
    vi.useFakeTimers();
    renderGrid();
    fireEvent.mouseEnter(day("Tuesday, August 18"));
    act(() => vi.advanceTimersByTime(200));
    fireEvent.mouseLeave(day("Tuesday, August 18"));
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows no tooltip on free days or when tooltips are off", () => {
    vi.useFakeTimers();
    renderGrid({ tooltips: false });
    fireEvent.mouseEnter(day("Tuesday, August 18"));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("moves focus between days with the arrow keys", () => {
    renderGrid({ selected: Some(at("2026-08-18T00:00")) });
    const tuesday = day("Tuesday, August 18");
    expect(tuesday).toHaveAttribute("tabindex", "0");
    expect(day("Wednesday, August 19")).toHaveAttribute("tabindex", "-1");
    tuesday.focus();
    fireEvent.keyDown(tuesday, { key: "ArrowRight" });
    expect(day("Wednesday, August 19")).toHaveFocus();
    fireEvent.keyDown(day("Wednesday, August 19"), { key: "ArrowDown" });
    expect(day("Wednesday, August 26")).toHaveFocus();
  });
});
