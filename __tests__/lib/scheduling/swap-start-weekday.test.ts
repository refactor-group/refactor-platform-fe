import { describe, expect, it } from "vitest";
import { swapStartWeekday } from "@/lib/schedule-draft";
import { Weekday } from "@/types/recurrence";

describe("swapStartWeekday", () => {
  it("replaces the old start weekday and keeps the other days in order", () => {
    expect(swapStartWeekday([Weekday.Mon, Weekday.Wed], Weekday.Wed, Weekday.Thu)).toEqual([Weekday.Mon, Weekday.Thu]);
    expect(swapStartWeekday([Weekday.Wed, Weekday.Fri], Weekday.Wed, Weekday.Tue)).toEqual([Weekday.Tue, Weekday.Fri]);
  });

  it("doesn't duplicate a day that was already chosen", () => {
    expect(swapStartWeekday([Weekday.Wed, Weekday.Thu], Weekday.Wed, Weekday.Thu)).toEqual([Weekday.Thu]);
  });

  it("leaves the days alone when the old start weekday wasn't chosen", () => {
    expect(swapStartWeekday([], Weekday.Wed, Weekday.Thu)).toEqual([]);
  });
});
