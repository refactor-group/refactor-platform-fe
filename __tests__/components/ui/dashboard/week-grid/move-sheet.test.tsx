import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some, type Option } from "@/types/option";
import type { DaySlot } from "@/lib/week-grid/slots";
import { MoveSheet, type MoveSheetModel } from "@/components/ui/dashboard/week-grid/move-sheet";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
const CURRENT = at("2026-08-18T14:30");
const days = Array.from({ length: 7 }, (_, i) => ({ day: at("2026-08-17T00:00").plus({ days: i }), past: i === 0 }));

function slotsFor(day: DateTime): DaySlot[] {
  const slot = (time: string, state: DaySlot["state"]) => ({ start: day.set({ hour: +time.slice(0, 2), minute: +time.slice(3) }), state });
  const isTuesday = day.hasSame(CURRENT, "day");
  return [
    slot("09:00", { kind: "taken", holder: "Priya" }),
    slot("10:00", { kind: "free" }),
    slot("14:30", isTuesday ? { kind: "current" } : { kind: "free" }),
  ];
}

const MODEL: MoveSheetModel = { name: "Ehab", current: CURRENT, days, slotsFor };

function renderSheet(model: Option<MoveSheetModel> = Some(MODEL)) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<MoveSheet model={model} onConfirm={onConfirm} onClose={onClose} />);
  return { onConfirm, onClose };
}

const sheet = () => screen.getByRole("dialog", { name: "Move Ehab's session" });
const confirm = () => within(sheet()).getByRole("button", { name: "Move session" });

describe("MoveSheet", () => {
  it("is closed without a model", () => {
    renderSheet(None);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on the session's day, with past days disabled", () => {
    renderSheet();
    expect(within(sheet()).getByRole("button", { name: "Tuesday, August 18" })).toHaveAttribute("aria-pressed", "true");
    expect(within(sheet()).getByRole("button", { name: "Monday, August 17" })).toBeDisabled();
  });

  it("names taken slots, marks the current one, and starts disabled", () => {
    renderSheet();
    const taken = within(sheet()).getByRole("button", { name: /^9:00 AM/ });
    expect(taken).toBeDisabled();
    expect(taken).toHaveTextContent("Priya");
    expect(within(sheet()).getByRole("button", { name: "2:30 PM, current" })).toHaveAttribute("aria-pressed", "true");
    expect(confirm()).toBeDisabled();
  });

  it("stays disabled after only changing the day", () => {
    renderSheet();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Thursday, August 20" }));
    expect(confirm()).toBeDisabled();
  });

  it("moves to a picked free slot", () => {
    const { onConfirm } = renderSheet();
    fireEvent.click(within(sheet()).getByRole("button", { name: "Thursday, August 20" }));
    fireEvent.click(within(sheet()).getByRole("button", { name: "10:00 AM" }));
    expect(confirm()).toBeEnabled();
    fireEvent.click(confirm());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].toISO()).toBe(at("2026-08-20T10:00").toISO());
  });

  it("goes back to disabled when the current slot is picked again", () => {
    renderSheet();
    fireEvent.click(within(sheet()).getByRole("button", { name: "10:00 AM" }));
    expect(confirm()).toBeEnabled();
    fireEvent.click(within(sheet()).getByRole("button", { name: "2:30 PM, current" }));
    expect(confirm()).toBeDisabled();
  });
});
