import { describe, expect, it } from "vitest";
import { suggestTimes } from "@/lib/scheduling";
import { None } from "@/types/option";
import { EHAB, NOW, PRIYA, TUESDAY, at, hhmm } from "./fixtures";

const NINE_TO_FIVE = { start: 9 * 60, end: 17 * 60 };

const base = {
  day: TUESDAY,
  minutes: 50,
  usual: None,
  busy: [EHAB, PRIYA],
  hours: NINE_TO_FIVE,
  now: NOW,
};

describe("suggestTimes: the coach's frequent starts", () => {
  it("ignores a start time the coach used only once", () => {
    const coachStarts = [at("2026-07-01T00:01"), at("2026-07-02T23:00"), at("2026-07-03T15:30")];
    expect(hhmm(suggestTimes({ ...base, coachStarts }))).toEqual(["09:00", "10:00", "11:00", "12:00", "13:00"]);
  });

  it("keeps a start time used twice or more, even outside working hours", () => {
    const coachStarts = [at("2026-07-01T07:30"), at("2026-07-08T07:30")];
    expect(hhmm(suggestTimes({ ...base, coachStarts }))).toEqual(["07:30", "09:00", "10:00", "11:00", "12:00"]);
  });
});
