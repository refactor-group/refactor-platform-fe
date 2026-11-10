import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import { lastSessionOf } from "@/lib/new-session-dialog-model";
import { Frequency, Weekday } from "@/types/recurrence";
import { lastOccurrence, lastSessionText } from "@/lib/schedule-draft";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
// Sunday, November 8 2026, 3:00 PM.
const START = at("2026-11-08T15:00");
const date = (d: ReturnType<typeof lastOccurrence>) => (d.some ? d.val.toISODate() : "none");

describe("lastOccurrence", () => {
  it("counts six Sundays from November 8 to December 13", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 6 } });
    expect(date(last)).toBe("2026-12-13");
  });

  it("keeps the start's time of day", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 6 } });
    expect(last.some && last.val.toFormat("HH:mm")).toBe("15:00");
  });

  it("counts every chosen weekday", () => {
    const monday = at("2026-11-09T10:00");
    const last = lastOccurrence({ start: monday, frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Mon, Weekday.Thu], end: { kind: "count", count: 3 } });
    expect(date(last)).toBe("2026-11-16");
  });

  it("skips the off weeks every 2 weeks", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Biweekly, interval: 1, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 3 } });
    expect(date(last)).toBe("2026-12-06");
  });

  it("goes by the day of the month monthly", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Monthly, interval: 1, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 3 } });
    expect(date(last)).toBe("2027-01-08");
  });

  it("is the start itself for one session", () => {
    const last = lastOccurrence({ start: START, frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Sun], end: { kind: "count", count: 1 } });
    expect(date(last)).toBe("2026-11-08");
  });

  it("is None for an end date, or a count that isn't a positive number", () => {
    const base = { start: START, frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Sun] };
    expect(lastOccurrence({ ...base, end: { kind: "until", until: "2027-01-03" } })).toEqual(None);
    expect(lastOccurrence({ ...base, end: { kind: "count", count: 0 } })).toEqual(None);
    expect(lastOccurrence({ ...base, end: { kind: "count", count: Number.NaN } })).toEqual(None);
  });
});

describe("lastOccurrence with an interval", () => {
  // Monday, November 9 2026, 10:00 AM.
  const monday = at("2026-11-09T10:00");
  const count = (n: number) => ({ kind: "count" as const, count: n });

  it("steps whole weeks: three sessions every three weeks end on December 21", () => {
    const last = lastOccurrence({ start: monday, frequency: Frequency.Weekly, interval: 3, byWeekdays: [Weekday.Mon], end: count(3) });
    expect(date(last)).toBe("2026-12-21");
  });

  it("doubles the step for every-other-week cadences", () => {
    const last = lastOccurrence({ start: monday, frequency: Frequency.Biweekly, interval: 2, byWeekdays: [Weekday.Mon], end: count(3) });
    expect(date(last)).toBe("2027-01-04");
  });

  it("steps months, on the start's day of the month", () => {
    const last = lastOccurrence({ start: monday, frequency: Frequency.Monthly, interval: 2, byWeekdays: [], end: count(3) });
    expect(date(last)).toBe("2027-03-09");
  });

  it("steps days", () => {
    const last = lastOccurrence({ start: monday, frequency: Frequency.Daily, interval: 3, byWeekdays: [], end: count(4) });
    expect(date(last)).toBe("2026-11-18");
  });
});

describe("lastSessionText", () => {
  it("names the weekday and date, and adds the year only when it changes", () => {
    expect(lastSessionText(at("2026-12-13T15:00"), START)).toBe("the last on Sun, Dec 13");
    expect(lastSessionText(at("2027-01-03T15:00"), START)).toBe("the last on Sun, Jan 3, 2027");
  });
});

describe("lastSessionOf", () => {
  it("names the right last date for a custom cadence", () => {
    const repeat = { kind: "repeat" as const, frequency: Frequency.Weekly, interval: 3, end: { kind: "count" as const, count: 3 } };
    expect(lastSessionOf(repeat, Some(at("2026-11-09T10:00")), [Weekday.Mon])).toEqual(Some("the last on Mon, Dec 21"));
  });
});
