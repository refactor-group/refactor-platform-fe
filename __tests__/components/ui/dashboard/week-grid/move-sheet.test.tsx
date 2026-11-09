import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some, type Option } from "@/types/option";
import type { BusyClash, BusySession } from "@/lib/scheduling";
import { MoveSheet, type MoveSheetModel } from "@/components/ui/dashboard/week-grid/move-sheet";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
// Tuesday, August 18, 1:00 PM.
const NOW = at("2026-08-18T13:00");
const CURRENT = at("2026-08-18T14:30");
const days = Array.from({ length: 7 }, (_, i) => ({ day: at("2026-08-17T00:00").plus({ days: i }), past: i === 0 }));

const PRIYA: BusySession = { id: "priya", personName: "Priya", start: at("2026-08-20T09:00"), end: at("2026-08-20T10:00") };

const MODEL: MoveSheetModel = {
  name: "Ehab",
  current: CURRENT,
  now: NOW,
  days,
  suggestionsFor: (day) => [day.set({ hour: 15 }), day.set({ hour: 16 }), day.set({ hour: 17 })],
  busyOn: (day) => (day.hasSame(PRIYA.start, "day") ? [PRIYA] : []),
  clashAt: (start): Option<BusyClash> =>
    start >= PRIYA.start && start < PRIYA.end
      ? Some({ session: PRIYA, others: [], instead: Some(at("2026-08-20T10:00")) })
      : None,
};

function renderSheet(model: Option<MoveSheetModel> = Some(MODEL)) {
  const onConfirm = vi.fn();
  const onResolve = vi.fn();
  const onClose = vi.fn();
  render(<MoveSheet model={model} onConfirm={onConfirm} onResolve={onResolve} onClose={onClose} />);
  return { onConfirm, onResolve, onClose };
}

const sheet = () => screen.getByRole("dialog", { name: "Move Ehab's session" });
const confirm = () => within(sheet()).getByRole("button", { name: "Move session" });
const timeInput = () => within(sheet()).getByLabelText("Start time");
const dayButton = (name: string) => within(sheet()).getByRole("button", { name });
const chip = (name: string) => within(sheet()).getByRole("button", { name });

describe("MoveSheet", () => {
  it("is closed without a model", () => {
    renderSheet(None);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the session's day at its current time, with past days disabled and Move off", () => {
    renderSheet();
    expect(dayButton("Tuesday, August 18")).toHaveAttribute("aria-pressed", "true");
    expect(dayButton("Monday, August 17")).toBeDisabled();
    expect(timeInput()).toHaveValue("14:30");
    expect(confirm()).toBeDisabled();
  });

  it("offers only the day's suggested times as chips, plus an exact time field", () => {
    renderSheet();
    const chips = within(sheet()).getAllByRole("button", { name: /^\d{1,2}:\d{2} [AP]M$/ });
    expect(chips.map((c) => c.textContent)).toEqual(["3:00 PM", "4:00 PM", "5:00 PM"]);
    expect(timeInput()).toBeInTheDocument();
  });

  it("moves to a suggested time on another day", () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(dayButton("Thursday, August 20"));
    fireEvent.click(chip("4:00 PM"));
    expect(chip("4:00 PM")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].toISO()).toBe(at("2026-08-20T16:00").toISO());
  });

  it("moves to an exact time typed into the field", () => {
    const { onConfirm } = renderSheet();
    fireEvent.change(timeInput(), { target: { value: "16:15" } });
    fireEvent.click(confirm());
    expect(onConfirm.mock.calls[0][0].toISO()).toBe(at("2026-08-18T16:15").toISO());
  });

  it("clears the time when the day changes, so Move never targets a time off screen", () => {
    renderSheet();
    fireEvent.click(chip("4:00 PM"));
    expect(confirm()).toBeEnabled();
    fireEvent.click(dayButton("Thursday, August 20"));
    expect(timeInput()).toHaveValue("");
    expect(chip("4:00 PM")).toHaveAttribute("aria-pressed", "false");
    expect(confirm()).toBeDisabled();
  });

  it("goes back to disabled at the current time", () => {
    renderSheet();
    fireEvent.click(chip("4:00 PM"));
    fireEvent.change(timeInput(), { target: { value: "14:30" } });
    expect(confirm()).toBeDisabled();
  });

  it("won't move into the past", () => {
    renderSheet();
    fireEvent.change(timeInput(), { target: { value: "12:00" } });
    expect(confirm()).toBeDisabled();
  });

  it("lists the day's other sessions", () => {
    renderSheet();
    fireEvent.click(dayButton("Thursday, August 20"));
    expect(sheet()).toHaveTextContent("Priya");
  });

  it("names an overlap, offers a free time instead, and resolves rather than moves", () => {
    const { onConfirm, onResolve } = renderSheet();
    fireEvent.click(dayButton("Thursday, August 20"));
    fireEvent.change(timeInput(), { target: { value: "09:15" } });
    expect(within(sheet()).queryByRole("button", { name: "Move session" })).not.toBeInTheDocument();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Resolve overlap…" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onResolve.mock.calls[0][0].toISO()).toBe(at("2026-08-20T09:15").toISO());
  });

  it("takes the offered free time instead of the overlap", () => {
    renderSheet();
    fireEvent.click(dayButton("Thursday, August 20"));
    fireEvent.change(timeInput(), { target: { value: "09:15" } });
    fireEvent.click(within(sheet()).getByRole("button", { name: /instead/ }));
    expect(timeInput()).toHaveValue("10:00");
    expect(confirm()).toBeEnabled();
  });
});
