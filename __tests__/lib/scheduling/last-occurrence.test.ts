import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { None } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { lastOccurrence, lastSessionText } from "@/lib/schedule-draft";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
// Sunday, November 8 2026, 3:00 PM.
const START = at("2026-11-08T15:00");
const date = (d: ReturnType<typeof lastOccurrence>) => (d.some ? d.val.toISODate() : "none");

describe("lastOccurrence", () => {
  it("counts six Sundays from November 8 to December 13", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Weekly, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 6 } });
    expect(date(last)).toBe("2026-12-13");
  });

  it("keeps the start's time of day", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Weekly, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 6 } });
    expect(last.some && last.val.toFormat("HH:mm")).toBe("15:00");
  });

  it("counts every chosen weekday", () => {
    const monday = at("2026-11-09T10:00");
    const last = lastOccurrence({ start: monday, frequency: Frequency.Weekly, byWeekdays: [Weekday.Mon, Weekday.Thu], end: { kind: "count", count: 3 } });
    expect(date(last)).toBe("2026-11-16");
  });

  it("skips the off weeks every 2 weeks", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Biweekly, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 3 } });
    expect(date(last)).toBe("2026-12-06");
  });

  it("goes by the day of the month monthly", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Monthly, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 3 } });
    expect(date(last)).toBe("2027-01-08");
  });

  it("is the start itself for one session", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Weekly, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 1 } });
    expect(date(last)).toBe("2026-11-08");
  });

  it("is None for an end date, or a count that isn't a positive number", () => {
    const base = { start: START, frequency: Frequency.Weekly, byWeekdays: [Weekday.Sun] };
    expect(lastOccurrence({ ...base, end: { kind: "until", until: "2027-01-03" } })).toEqual(None);
    expect(lastOccurrence({ ...base, end: { kind: "count", count: 0 } })).toEqual(None);
    expect(lastOccurrence({ ...base, end: { kind: "count", count: Number.NaN } })).toEqual(None);
  });
});

describe("lastSessionText", () => {
  it("names the weekday and date, and adds the year only when it changes", () => {
    expect(lastSessionText(at("2026-12-13T15:00"), START)).toBe("the last on Sun, Dec 13");
    expect(lastSessionText(at("2027-01-03T15:00"), START)).toBe("the last on Sun, Jan 3, 2027");
  });
});
