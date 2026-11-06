import { describe, expect, it } from "vitest";
import { None, Some } from "@/types/option";
import {
  WORKING_HOURS_FALLBACK,
  clockLabel,
  formatClock,
  halfHourClocks,
  parseClock,
  workingHoursOf,
} from "@/lib/working-hours";
import { createMockUser } from "../test-utils";

describe("parseClock", () => {
  it.each([
    ["08:00", Some(480)],
    ["17:30", Some(1050)],
    ["00:00", Some(0)],
    ["23:30", Some(1410)],
    ["8:00", None],
    ["08:15", None],
    ["24:00", None],
    ["08:00:00", None],
    ["", None],
  ])("%j → %o", (text, expected) => {
    expect(parseClock(text)).toEqual(expected);
  });
});

describe("formatClock and clockLabel", () => {
  it("writes HH:MM for the wire and h:mm a for people", () => {
    expect(formatClock(480)).toBe("08:00");
    expect(formatClock(1050)).toBe("17:30");
    expect(clockLabel(480)).toBe("8:00 AM");
    expect(clockLabel(1050)).toBe("5:30 PM");
    expect(clockLabel(0)).toBe("12:00 AM");
  });
});

describe("halfHourClocks", () => {
  it("lists every half hour of the day", () => {
    const all = halfHourClocks();
    expect(all).toHaveLength(48);
    expect(all[0]).toBe(0);
    expect(all[47]).toBe(1410);
  });
});

describe("workingHoursOf", () => {
  it("reads the user's hours", () => {
    const user = createMockUser({ working_hours_start: "07:30", working_hours_end: "16:00" });
    expect(workingHoursOf(Some(user))).toEqual({ start: 450, end: 960 });
  });

  it("falls back to 8:00 to 5:30 without a user or with unreadable hours", () => {
    expect(WORKING_HOURS_FALLBACK).toEqual({ start: 480, end: 1050 });
    expect(workingHoursOf(None)).toEqual(WORKING_HOURS_FALLBACK);
    const bad = createMockUser({ working_hours_start: "nope", working_hours_end: "16:00" });
    expect(workingHoursOf(Some(bad))).toEqual(WORKING_HOURS_FALLBACK);
    const backwards = createMockUser({ working_hours_start: "18:00", working_hours_end: "09:00" });
    expect(workingHoursOf(Some(backwards))).toEqual(WORKING_HOURS_FALLBACK);
  });
});
