import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { sessionEndIn, sessionStartIn, toSessionDate } from "@/lib/session-window";

const ZONE = "America/Chicago";

describe("sessionEndIn", () => {
  it("is the start plus the duration, in the user's zone", () => {
    const end = sessionEndIn({ date: "2026-08-18T19:30:00", duration_minutes: 50 }, ZONE);
    expect(end.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-08-18 15:20");
    expect(end.zoneName).toBe(ZONE);
  });
});

describe("toSessionDate", () => {
  it("writes a local time as the stored naive UTC date", () => {
    expect(toSessionDate(DateTime.fromISO("2026-08-18T14:30", { zone: ZONE }))).toBe("2026-08-18T19:30:00");
  });

  it("round-trips with sessionStartIn", () => {
    const local = DateTime.fromISO("2026-11-03T09:00", { zone: ZONE });
    expect(sessionStartIn(toSessionDate(local), ZONE).toMillis()).toBe(local.toMillis());
  });
});
