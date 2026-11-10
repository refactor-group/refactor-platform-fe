import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { moveChoices } from "@/lib/week-grid/move-choices";
import { createMockEnrichedSession } from "../../test-utils";

const TZ = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: TZ });
const HOURS = { start: 8 * 60, end: 17 * 60 + 30 };
// Session dates are UTC: Tuesday 2:30 PM and Thursday 10:00 AM in Chicago.
const MOVING = createMockEnrichedSession({ id: "moving", date: "2026-08-18T19:30:00", duration_minutes: 50 });
const OTHER = createMockEnrichedSession({ id: "other", date: "2026-08-20T15:00:00", duration_minutes: 50 });
const TUESDAY = at("2026-08-18T00:00");
const THURSDAY = at("2026-08-20T00:00");

// The shown week and whatever of its neighbours has loaded.
const THIS_WEEK = { from: at("2026-08-17T00:00"), to: at("2026-08-24T00:00") };
const choices = (now = at("2026-08-17T07:00"), sessions = [MOVING, OTHER], known = THIS_WEEK) =>
  moveChoices(MOVING, { sessions, viewerId: "coach-1", timezone: TZ, hours: HOURS, now, known });
const clock = (times: DateTime[]) => times.map((t) => t.toFormat("HH:mm"));

describe("moveChoices", () => {
  it("suggests a few free times in order, the session's own time of day among them", () => {
    const times = choices().suggestionsFor(THURSDAY);
    expect(times.length).toBeGreaterThan(0);
    expect(times.length).toBeLessThanOrEqual(5);
    expect(clock(times)).toContain("14:30");
    expect([...times].sort((a, b) => a.toMillis() - b.toMillis())).toEqual(times);
    expect(times.every((t) => t.hasSame(THURSDAY, "day"))).toBe(true);
  });

  it("never suggests a time that overlaps another session", () => {
    const times = clock(choices().suggestionsFor(THURSDAY));
    expect(times).not.toContain("09:30");
    expect(times).not.toContain("10:00");
  });

  it("never suggests the current time or a time already past", () => {
    const times = choices(at("2026-08-18T13:00")).suggestionsFor(TUESDAY);
    expect(clock(times)).not.toContain("14:30");
    expect(times.every((t) => t >= at("2026-08-18T13:00"))).toBe(true);
  });

  it("lists the day's other sessions, never the one moving", () => {
    expect(choices().busyOn(THURSDAY).map((b) => b.id)).toEqual(["other"]);
    expect(choices().busyOn(TUESDAY)).toEqual([]);
  });

  it("finds an overlap with another session, with a free time instead", () => {
    const clash = choices().clashAt(at("2026-08-20T10:15"));
    expect(clash.some && clash.val.session.id).toBe("other");
    expect(clash.some && clash.val.instead.some).toBe(true);
  });

  it("doesn't count the moving session as an overlap", () => {
    expect(choices().clashAt(at("2026-08-18T14:45")).none).toBe(true);
  });

  it("sees an overlap in the next week when that week's sessions are passed in", () => {
    // Monday, August 24, midnight in Chicago.
    const nextMonday = createMockEnrichedSession({ id: "next-monday", date: "2026-08-24T05:00:00", duration_minutes: 50 });
    const known = { from: THIS_WEEK.from, to: at("2026-08-31T00:00") };
    const clash = choices(undefined, [MOVING, OTHER, nextMonday], known).clashAt(at("2026-08-23T23:45"));
    expect(clash.some && clash.val.session.id).toBe("next-monday");
  });

  it("covers only times whose whole session falls inside the loaded span", () => {
    expect(choices().covers(at("2026-08-23T10:00"))).toBe(true);
    expect(choices().covers(at("2026-08-23T23:45"))).toBe(false);
    const known = { from: THIS_WEEK.from, to: at("2026-08-31T00:00") };
    expect(choices(undefined, undefined, known).covers(at("2026-08-23T23:45"))).toBe(true);
  });
});
