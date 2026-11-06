import { describe, expect, it } from "vitest";
import { suggestTimes } from "@/lib/scheduling";
import { Some } from "@/types/option";
import { NOW, TUESDAY, busy, hhmm } from "./fixtures";

const NINE_TO_FIVE = { start: 9 * 60, end: 17 * 60 };

const base = { day: TUESDAY, coachStarts: [], hours: NINE_TO_FIVE, now: NOW };

describe("suggestTimes across midnight", () => {
  it("skips a late start that runs into a session the next morning", () => {
    const wednesday = busy("s-wed", "Alex Chen", "2026-08-19T00:00", "2026-08-19T00:50");
    const result = suggestTimes({ ...base, minutes: 60, usual: Some({ weekday: 2, minute: 23 * 60 + 30 }), busy: [wednesday] });
    expect(hhmm(result)).not.toContain("23:30");
  });

  it("skips an early start inside a session left over from the night before", () => {
    const monday = busy("s-mon", "Alex Chen", "2026-08-17T23:30", "2026-08-18T00:30");
    const result = suggestTimes({ ...base, minutes: 30, usual: Some({ weekday: 2, minute: 0 }), busy: [monday] });
    expect(hhmm(result)).not.toContain("00:00");
  });

  it("still suggests a late start when the next morning is free", () => {
    const result = suggestTimes({ ...base, minutes: 60, usual: Some({ weekday: 2, minute: 23 * 60 + 30 }), busy: [] });
    expect(hhmm(result)).toContain("23:30");
  });
});
