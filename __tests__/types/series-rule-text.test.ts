import { describe, expect, it } from "vitest";
import { None, Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { defaultCoachingSessionSeries, formatSeriesRule, seriesEndText, seriesRepeatsText } from "@/types/coaching-session-series";

const rule = (recurrence: Partial<ReturnType<typeof defaultCoachingSessionSeries>["rule"]["recurrence"]>) => {
  const base = defaultCoachingSessionSeries().rule;
  return { ...base, recurrence: { ...base.recurrence, ...recurrence } };
};

describe("series rule text", () => {
  it("says how it repeats", () => {
    expect(seriesRepeatsText(rule({ frequency: Frequency.Weekly, interval: 1, by_weekdays: [Weekday.Tue] }))).toBe("Weekly on Tue");
    expect(seriesRepeatsText(rule({ frequency: Frequency.Weekly, interval: 1, by_weekdays: [Weekday.Mon, Weekday.Thu] }))).toBe("Weekly on Mon, Thu");
  });

  it("says when it ends", () => {
    expect(seriesEndText(rule({ until: Some("2026-11-17") }))).toBe("Until Nov 17, 2026");
    expect(seriesEndText(rule({ count: Some(8) }))).toBe("After 8 sessions");
    expect(seriesEndText(rule({ count: Some(1) }))).toBe("After 1 session");
    expect(seriesEndText(rule({ count: None, until: None }))).toBe("No end date");
  });

  it("still formats the one-line rule the same way", () => {
    expect(formatSeriesRule(rule({ frequency: Frequency.Weekly, interval: 1, by_weekdays: [Weekday.Tue], until: Some("2026-11-17") }))).toBe(
      "Weekly on Tue · until Nov 17, 2026"
    );
  });
});
