import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { nowLineIndex, nowLineProgress } from "@/lib/week-grid/week";
import { None, Some } from "@/types/option";

const TZ = "America/Chicago";
const at = (time: string) => DateTime.fromISO(`2026-08-18T${time}`, { zone: TZ });
const starts = [at("09:00"), at("11:00"), at("14:30")];
const index = (now: string) => nowLineIndex(starts, (s) => s, at(now));

describe("nowLineIndex", () => {
  it("goes before the first session that hasn't started", () => {
    expect(index("10:15")).toBe(1);
    expect(index("12:00")).toBe(2);
  });

  it("keeps a session that started at this very minute above the line", () => {
    expect(index("11:00")).toBe(2);
  });

  it("goes on top before anything starts, and at the bottom after everything has", () => {
    expect(index("07:00")).toBe(0);
    expect(index("16:00")).toBe(3);
  });

  it("goes at the top of an empty day", () => {
    expect(nowLineIndex([], (s: DateTime) => s, at("10:00"))).toBe(0);
  });
});

describe("nowLineProgress", () => {
  const progress = (now: string) => nowLineProgress(at("14:00"), 45, at(now));

  it("steps through a session under way in 5-minute increments", () => {
    expect(progress("14:00")).toEqual(Some(0));
    expect(progress("14:08")).toEqual(Some(5 / 45));
    expect(progress("14:44")).toEqual(Some(40 / 45));
  });

  it("is None before the start and from the end on", () => {
    expect(progress("13:59")).toEqual(None);
    expect(progress("14:45")).toEqual(None);
  });
});
