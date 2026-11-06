import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { settledOutcome, targetOutcome, type DropTarget } from "@/lib/week-grid/slots";
import { None, Some } from "@/types/option";

const start = DateTime.fromISO("2026-10-23T10:00", { zone: "America/Chicago" });
const free: DropTarget = { kind: "slot", slot: { start, state: { kind: "free" } } };

describe("targetOutcome", () => {
  it("follows the slot, and ignores a day or nothing", () => {
    expect(targetOutcome(Some(free))).toEqual({ kind: "move", start });
    expect(targetOutcome(Some({ kind: "day", day: start.startOf("day") }))).toEqual({ kind: "ignore" });
    expect(targetOutcome(None)).toEqual({ kind: "ignore" });
  });
});

describe("settledOutcome", () => {
  it("ignores a drop that never moved", () => {
    expect(settledOutcome({ kind: "move", start }, { x: 0, y: 0 })).toEqual({ kind: "ignore" });
    expect(settledOutcome({ kind: "resolve", start }, { x: 0, y: 0 })).toEqual({ kind: "ignore" });
  });

  it("keeps the outcome once it moved", () => {
    expect(settledOutcome({ kind: "move", start }, { x: 0, y: 25 })).toEqual({ kind: "move", start });
    expect(settledOutcome({ kind: "resolve", start }, { x: -3, y: 0 })).toEqual({ kind: "resolve", start });
  });
});
