import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import type { BusySession } from "@/lib/scheduling";
import { daySlots, dropOutcome } from "@/lib/week-grid/slots";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
const HOURS = { start: 8 * 60, end: 17 * 60 + 30 };
// Monday, August 17, 7:00 AM: nothing on Tuesday is past.
const NOW = at("2026-08-17T07:00");
const TUESDAY = at("2026-08-18T00:00");

const busy = (id: string, personName: string, start: string, minutes = 50): BusySession => ({
  id,
  personName,
  start: at(start),
  end: at(start).plus({ minutes }),
});
const MOVING = busy("moving", "Ehab Bandar", "2026-08-18T14:30");
const PRIYA = busy("priya", "Priya Raman", "2026-08-18T09:00");

const slots = (input: Partial<Parameters<typeof daySlots>[0]> = {}) =>
  daySlots({ day: TUESDAY, moving: MOVING, busy: [MOVING, PRIYA], hours: HOURS, now: NOW, ...input });
const label = (s: { start: DateTime }) => s.start.toFormat("HH:mm");

describe("daySlots", () => {
  it("lists every 30 minutes whose session would end by the end of working hours", () => {
    const all = slots({ day: at("2026-08-19T00:00") });
    expect(all).toHaveLength(18);
    expect(label(all[0])).toBe("08:00");
    expect(label(all[17])).toBe("16:30");
  });

  it("offers a start whose session ends exactly at the end of working hours", () => {
    const hour = busy("moving", "Ehab Bandar", "2026-08-18T14:30", 60);
    const all = slots({ day: at("2026-08-19T00:00"), moving: hour, busy: [hour] });
    expect(label(all[all.length - 1])).toBe("16:30");
  });

  it("keeps the current slot even when it runs past the end of working hours", () => {
    const late = busy("moving", "Ehab Bandar", "2026-08-18T17:00");
    const all = slots({ moving: late, busy: [late, PRIYA] });
    expect(all.map(label).slice(-2)).toEqual(["16:30", "17:00"]);
    expect(all[all.length - 1].state).toEqual({ kind: "current" });
  });

  it("marks slots the moving session would overlap as taken, naming the holder", () => {
    const byTime = new Map(slots().map((s) => [label(s), s.state]));
    expect(byTime.get("08:30")).toEqual({ kind: "taken", holder: "Priya" });
    expect(byTime.get("09:00")).toEqual({ kind: "taken", holder: "Priya" });
    expect(byTime.get("09:30")).toEqual({ kind: "taken", holder: "Priya" });
    expect(byTime.get("10:00")).toEqual({ kind: "free" });
  });

  it("marks the moving session's own start as current, never as taken by itself", () => {
    const byTime = new Map(slots().map((s) => [label(s), s.state]));
    expect(byTime.get("14:30")).toEqual({ kind: "current" });
    expect(byTime.get("14:00")).toEqual({ kind: "free" });
    expect(byTime.get("15:00")).toEqual({ kind: "free" });
  });

  it("keeps the current slot even outside working hours, in time order", () => {
    const late = busy("moving", "Ehab Bandar", "2026-08-18T18:00");
    const all = slots({ moving: late, busy: [late, PRIYA] });
    expect(all).toHaveLength(19);
    expect(label(all[18])).toBe("18:00");
    expect(all[18].state).toEqual({ kind: "current" });
  });

  it("has no current slot on another day", () => {
    const wednesday = slots({ day: at("2026-08-19T00:00") });
    expect(wednesday.some((s) => s.state.kind === "current")).toBe(false);
  });

  it("keeps the current slot current even once its start has passed", () => {
    const byTime = new Map(slots({ now: at("2026-08-18T15:00") }).map((s) => [label(s), s.state]));
    expect(byTime.get("14:30")).toEqual({ kind: "current" });
    expect(byTime.get("14:00")).toEqual({ kind: "past" });
  });

  it("marks starts before now as past", () => {
    const byTime = new Map(slots({ now: at("2026-08-18T10:15") }).map((s) => [label(s), s.state]));
    expect(byTime.get("10:00")).toEqual({ kind: "past" });
    expect(byTime.get("10:30")).toEqual({ kind: "free" });
  });
});

describe("dropOutcome", () => {
  const start = at("2026-08-20T10:00");

  it("moves straight away onto a free slot", () => {
    expect(dropOutcome({ start, state: { kind: "free" } })).toEqual({ kind: "move", start });
  });

  it("sends a taken slot to the reschedule dialog to resolve", () => {
    expect(dropOutcome({ start, state: { kind: "taken", holder: "Priya" } })).toEqual({ kind: "resolve", start });
  });

  it("ignores the session's own slot and past slots", () => {
    expect(dropOutcome({ start, state: { kind: "current" } })).toEqual({ kind: "ignore" });
    expect(dropOutcome({ start, state: { kind: "past" } })).toEqual({ kind: "ignore" });
  });
});
