import { describe, expect, it } from "vitest";
import { followingMoves } from "@/lib/move-draft";
import { followingMoveLine } from "@/lib/scheduling-copy";
import { toSessionDate } from "@/lib/session-window";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { ZONE, at, session } from "./roster";

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };

/** A weekly Tuesday 3:00 PM session, optionally moved on its own to `movedTo`. */
function tuesday(slot: string, movedTo = slot): EnrichedCoachingSession {
  const s = session({ id: "anchor", relationshipId: "rel-e", person: EHAB, start: movedTo, series: "series-e" });
  return { ...s, ical_recurrence_id: Some(toSessionDate(at(slot))) };
}

const WEEKLY_TUE = { frequency: Frequency.Weekly, interval: 1, byWeekdays: [Weekday.Tue] };
const CURRENT = { ...WEEKLY_TUE, end: { kind: "count" as const, count: 3 } };
const ANCHOR = tuesday("2026-11-17T15:00");

const moves = (start: string, rule: Partial<typeof WEEKLY_TUE> = {}, anchor = ANCHOR) =>
  followingMoves({ anchor, start: at(start), rule: { ...WEEKLY_TUE, ...rule, current: CURRENT }, timezone: ZONE });

describe("followingMoves", () => {
  it("moves nothing when the rule keeps every slot, as when only the end changes", () => {
    expect(moves("2026-11-17T15:00")).toBe(false);
  });

  it("moves when the time changes", () => {
    expect(moves("2026-11-17T14:00")).toBe(true);
  });

  it("moves when the weekdays change, even with the anchor in place", () => {
    expect(moves("2026-11-17T15:00", { byWeekdays: [Weekday.Tue, Weekday.Thu] })).toBe(true);
  });

  it("moves when the rhythm changes", () => {
    expect(moves("2026-11-17T15:00", { interval: 3 })).toBe(true);
  });

  it("moves the anchor back when it sits away from its unchanged slot", () => {
    expect(moves("2026-11-17T15:00", {}, tuesday("2026-11-17T15:00", "2026-11-18T15:00"))).toBe(true);
  });
});

describe("followingMoveLine", () => {
  const start = at("2026-11-17T14:00");
  const weekly = { frequency: Frequency.Weekly, interval: 1 };

  it("names the weekdays and time", () => {
    expect(followingMoveLine(weekly, [Weekday.Tue], start)).toBe("Move this and following sessions to Tuesdays, 2:00 PM");
  });

  it("joins several weekdays", () => {
    expect(followingMoveLine(weekly, [Weekday.Tue, Weekday.Thu], start)).toBe(
      "Move this and following sessions to Tuesdays and Thursdays, 2:00 PM"
    );
  });

  it("uses the rhythm when the rule has no weekdays", () => {
    expect(followingMoveLine({ frequency: Frequency.Monthly, interval: 1 }, [], start)).toBe(
      "Move this and following sessions to 2:00 PM, monthly"
    );
  });
});
