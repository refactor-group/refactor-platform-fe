import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { CANCELLED_LINE, droppedLine, overLine, pickedUpLine } from "@/lib/week-grid/drag-announcements";
import type { DaySlot, DropTarget } from "@/lib/week-grid/slots";
import { None, Some } from "@/types/option";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/Chicago" });
const FRIDAY_10 = at("2026-10-23T10:00");
const slot = (state: DaySlot["state"]): DropTarget => ({ kind: "slot", slot: { start: FRIDAY_10, state } });
const day: DropTarget = { kind: "day", day: at("2026-10-23T00:00") };

describe("drag announcements", () => {
  it("names the picked-up session", () => {
    expect(pickedUpLine({ name: "Jane Smith", start: at("2026-10-22T10:00") })).toBe("Picked up Jane Smith's session at 10:00 AM.");
  });

  it("reads free and taken slots, and days", () => {
    expect(overLine(Some(slot({ kind: "free" })))).toEqual(Some("Friday 10:00 AM, free."));
    expect(overLine(Some(slot({ kind: "taken", holder: "Priya" })))).toEqual(Some("Friday 10:00 AM, taken by Priya."));
    expect(overLine(Some(day))).toEqual(Some("Friday."));
    expect(overLine(None)).toEqual(None);
  });

  it("says what a drop did", () => {
    expect(droppedLine(Some(slot({ kind: "free" })))).toBe("Moved to Friday 10:00 AM.");
    expect(droppedLine(Some(slot({ kind: "taken", holder: "Priya" })))).toBe("That time is taken. Opening reschedule.");
    expect(droppedLine(Some(slot({ kind: "current" })))).toBe("Not moved.");
    expect(droppedLine(Some(day))).toBe("Not moved.");
    expect(droppedLine(None)).toBe("Not moved.");
    expect(CANCELLED_LINE).toBe("Move cancelled.");
  });
});
