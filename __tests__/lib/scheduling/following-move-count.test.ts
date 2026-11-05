import { describe, expect, it } from "vitest";
import { followingMoveCount } from "@/lib/move-draft";
import { followingMoveLine } from "@/lib/scheduling-copy";
import { toSessionDate } from "@/lib/session-window";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { ZONE, at, session } from "./roster";

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };

/** A weekly Tuesday 3:00 PM session, optionally moved on its own to `movedTo`. */
function tuesday(id: string, slot: string, movedTo?: string): EnrichedCoachingSession {
  const s = session({ id, relationshipId: "rel-e", person: EHAB, start: movedTo ?? slot, series: "series-e" });
  return { ...s, ical_recurrence_id: Some(toSessionDate(at(slot))) };
}

const NOV_17 = tuesday("nov-17", "2026-11-17T15:00");
const NOV_24 = tuesday("nov-24", "2026-11-24T15:00");
const DEC_01 = tuesday("dec-01", "2026-12-01T15:00");
const MOVED_TO_WED = tuesday("nov-24", "2026-11-24T15:00", "2026-11-25T15:00");
const SESSIONS = [NOV_17, NOV_24, DEC_01];

const WEEKLY_TUE = { frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Tue] };
const RULE = { ...WEEKLY_TUE, current: { ...WEEKLY_TUE, end: { kind: "count" as const, count: 3 } } };

const count = (sessions: EnrichedCoachingSession[], start: string, slots = 3, anchor = NOV_17) =>
  followingMoveCount({ anchor, sessions, start: at(start), slots, rule: RULE, timezone: ZONE });

describe("followingMoveCount", () => {
  it("moves the anchor and every later session on its slot", () => {
    expect(count(SESSIONS, "2026-11-17T14:00")).toBe(3);
  });

  it("leaves out a session moved on its own", () => {
    expect(count([NOV_17, MOVED_TO_WED, DEC_01], "2026-11-17T14:00")).toBe(2);
  });

  it("counts a session moved on its own when its date falls before the new start", () => {
    expect(count([NOV_17, MOVED_TO_WED, DEC_01], "2026-11-26T14:00")).toBe(3);
  });

  it("leaves out sessions past the new rule's last slot, which are removed", () => {
    expect(count(SESSIONS, "2026-11-17T14:00", 2)).toBe(2);
  });

  it("ignores earlier sessions in the series", () => {
    const earlier = tuesday("nov-10", "2026-11-10T15:00");
    expect(count([earlier, ...SESSIONS], "2026-11-17T14:00")).toBe(3);
  });

  it("moves nothing when the rule keeps every slot, as when only the end changes", () => {
    expect(count(SESSIONS, "2026-11-17T15:00", 5)).toBe(0);
  });

  it("moves only the anchor back when it sits away from its unchanged slot", () => {
    const anchorMoved = tuesday("nov-17", "2026-11-17T15:00", "2026-11-18T15:00");
    expect(count([anchorMoved, NOV_24, DEC_01], "2026-11-17T15:00", 3, anchorMoved)).toBe(1);
  });

  it("moves the following sessions when the weekdays change, even at the same time", () => {
    const thursdays = { ...RULE, byWeekdays: [Weekday.Thu] };
    expect(
      followingMoveCount({ anchor: NOV_17, sessions: SESSIONS, start: at("2026-11-19T15:00"), slots: 3, rule: thursdays, timezone: ZONE })
    ).toBe(3);
  });

  it("treats a session without an original slot as on its slot", () => {
    expect(count([NOV_17, { ...NOV_24, ical_recurrence_id: None }, DEC_01], "2026-11-17T14:00")).toBe(3);
  });
});

describe("followingMoveLine", () => {
  const start = at("2026-11-17T14:00");
  const weekly = { frequency: Frequency.Weekly, interval: 1 };

  it("names the weekdays and time", () => {
    expect(followingMoveLine(2, weekly, [Weekday.Tue], start)).toBe("Move 2 sessions to Tuesdays, 2:00 PM");
  });

  it("joins several weekdays", () => {
    expect(followingMoveLine(4, weekly, [Weekday.Tue, Weekday.Thu], start)).toBe(
      "Move 4 sessions to Tuesdays and Thursdays, 2:00 PM"
    );
  });

  it("uses the rhythm when the rule has no weekdays", () => {
    expect(followingMoveLine(1, { frequency: Frequency.Monthly, interval: 1 }, [], start)).toBe(
      "Move 1 session to 2:00 PM, monthly"
    );
  });
});
