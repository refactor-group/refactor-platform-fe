import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WeekdayPicker } from "@/components/ui/new-session/weekday-picker";
import { Weekday } from "@/types/recurrence";

describe("WeekdayPicker", () => {
  it("shows seven days, Monday first, as letters", () => {
    render(<WeekdayPicker value={[Weekday.Tue]} locked={Weekday.Tue} onChange={vi.fn()} />);
    const days = screen.getAllByRole("button");
    expect(days.map((d) => d.getAttribute("aria-label"))).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    expect(days.map((d) => d.textContent)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
  });

  it("marks the chosen days", () => {
    render(<WeekdayPicker value={[Weekday.Tue, Weekday.Thu]} locked={Weekday.Tue} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Thursday" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Friday" })).toHaveAttribute("aria-pressed", "false");
  });

  it("adds and removes days in week order", () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[Weekday.Tue, Weekday.Fri]} locked={Weekday.Tue} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Monday" }));
    expect(onChange).toHaveBeenLastCalledWith([Weekday.Mon, Weekday.Tue, Weekday.Fri]);
    fireEvent.click(screen.getByRole("button", { name: "Friday" }));
    expect(onChange).toHaveBeenLastCalledWith([Weekday.Tue]);
  });

  it("keeps the start weekday", () => {
    const onChange = vi.fn();
    render(<WeekdayPicker value={[Weekday.Tue]} locked={Weekday.Tue} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Tuesday" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Tuesday" })).toHaveAttribute("aria-pressed", "true");
  });
});
