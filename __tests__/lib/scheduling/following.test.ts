import { describe, expect, it } from "vitest";
import { followingPayload, seriesRepeatFrom } from "@/lib/move-draft";
import { StepKind, stepOrder } from "@/lib/scheduling";
import { seriesRuleLine } from "@/lib/scheduling-copy";
import type { CoachingSessionSeriesWithSessions, SeriesRecurrence } from "@/types/coaching-session-series";
import { None, Some } from "@/types/option";
import { Frequency, Weekday } from "@/types/recurrence";
import { E_04, E_11, E_18, ZONE, at, session } from "./roster";

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };
const E_25 = session({ id: "e-25", relationshipId: "rel-e", person: EHAB, start: "2026-08-25T14:30", series: "series-e" });
const E_01 = session({ id: "e-01", relationshipId: "rel-e", person: EHAB, start: "2026-09-01T14:30", series: "series-e" });

const recurrence = (overrides: Partial<SeriesRecurrence> = {}): SeriesRecurrence => ({
  frequency: Frequency.Weekly,
  interval: 1,
  by_weekdays: [Weekday.Tue],
  count: Some(5),
  until: None,
  ...overrides,
});

function series(rec: SeriesRecurrence): CoachingSessionSeriesWithSessions {
  return {
    id: "series-e",
    coaching_relationship_id: "rel-e",
    rule: { start_at: E_04.date, recurrence: rec, duration_minutes: 50 },
    created_by_user_id: "me",
    created_at: at("2026-07-01T00:00"),
    updated_at: at("2026-07-01T00:00"),
    coaching_sessions: [E_04, E_11, E_18, E_25, E_01],
  };
}

describe("stepOrder: move with a scope", () => {
  it("adds Repeat for this and following", () => {
    expect(stepOrder({ kind: "move", appliesTo: true, following: true }, false)).toEqual([
      StepKind.When,
      StepKind.AppliesTo,
      StepKind.Repeat,
    ]);
    expect(stepOrder({ kind: "move", appliesTo: true, following: true }, true)).toEqual([
      StepKind.When,
      StepKind.AppliesTo,
      StepKind.Repeat,
      StepKind.Resolve,
    ]);
  });

  it("has no Repeat for this session only", () => {
    expect(stepOrder({ kind: "move", appliesTo: true, following: false }, false)).toEqual([
      StepKind.When,
      StepKind.AppliesTo,
    ]);
    expect(stepOrder({ kind: "move", appliesTo: false, following: false }, false)).toEqual([StepKind.When]);
  });
});

describe("seriesRuleLine", () => {
  it("names the rhythm and the days", () => {
    expect(seriesRuleLine("Ehab Badawi", recurrence())).toBe("Ehab's series repeats weekly on Tuesdays.");
    expect(
      seriesRuleLine("Ehab Badawi", recurrence({ frequency: Frequency.Biweekly, by_weekdays: [Weekday.Tue, Weekday.Thu] }))
    ).toBe("Ehab's series repeats every 2 weeks on Tuesdays and Thursdays.");
    expect(
      seriesRuleLine("Ehab Badawi", recurrence({ by_weekdays: [Weekday.Mon, Weekday.Wed, Weekday.Fri] }))
    ).toBe("Ehab's series repeats weekly on Mondays, Wednesdays and Fridays.");
    expect(seriesRuleLine("Ehab Badawi", recurrence({ interval: 2 }))).toBe(
      "Ehab's series repeats every 2 weeks on Tuesdays."
    );
  });

  it("leaves out days where the rule has none", () => {
    expect(seriesRuleLine("Ehab Badawi", recurrence({ frequency: Frequency.Monthly, by_weekdays: undefined }))).toBe(
      "Ehab's series repeats monthly."
    );
    expect(seriesRuleLine("Ehab Badawi", recurrence({ frequency: Frequency.Daily, by_weekdays: undefined }))).toBe(
      "Ehab's series repeats daily."
    );
  });
});

describe("seriesRepeatFrom", () => {
  it("counts this session and the ones after it", () => {
    expect(seriesRepeatFrom(series(recurrence()), E_18)).toEqual({
      frequency: Frequency.Weekly,
      interval: 1,
      byWeekdays: [Weekday.Tue],
      end: { kind: "count", count: 3 },
    });
  });

  it("keeps an end date", () => {
    const repeat = seriesRepeatFrom(series(recurrence({ count: None, until: Some("2026-12-15") })), E_18);
    expect(repeat.end).toEqual({ kind: "until", until: "2026-12-15" });
  });

  it("treats every 2 weeks as Biweekly", () => {
    const repeat = seriesRepeatFrom(series(recurrence({ interval: 2 })), E_18);
    expect(repeat.frequency).toBe(Frequency.Biweekly);
    expect(repeat.interval).toBe(1);
  });

  it("keeps any other interval", () => {
    const repeat = seriesRepeatFrom(series(recurrence({ interval: 3 })), E_18);
    expect([repeat.frequency, repeat.interval]).toEqual([Frequency.Weekly, 3]);
  });
});

describe("followingPayload", () => {
  it("sends the new start, duration and full rule", () => {
    expect(
      followingPayload({
        sessionId: "e-18",
        start: at("2026-08-20T14:30"),
        minutes: 50,
        frequency: Frequency.Weekly,
        interval: 1,
        byWeekdays: [Weekday.Thu],
        end: { kind: "count", count: 3 },
        timezone: ZONE,
      })
    ).toEqual({
      coaching_session_id: "e-18",
      start_at: "2026-08-20T19:30:00",
      duration_minutes: 50,
      recurrence: { frequency: Frequency.Weekly, by_weekdays: [Weekday.Thu], count: 3 },
    });
  });

  it("sends an end date as the end of that day", () => {
    const payload = followingPayload({
      sessionId: "e-18",
      start: at("2026-08-20T14:30"),
      minutes: 50,
      frequency: Frequency.Monthly,
      interval: 1,
      byWeekdays: [],
      end: { kind: "until", until: "2026-12-15" },
      timezone: ZONE,
    });
    expect(payload.recurrence).toEqual({ frequency: Frequency.Monthly, until: "2026-12-16T05:59:59" });
  });

  it("sends an interval other than 1", () => {
    const payload = followingPayload({
      sessionId: "e-18",
      start: at("2026-08-20T14:30"),
      minutes: 50,
      frequency: Frequency.Monthly,
      interval: 2,
      byWeekdays: [],
      end: { kind: "count", count: 3 },
      timezone: ZONE,
    });
    expect(payload.recurrence).toEqual({ frequency: Frequency.Monthly, interval: 2, count: 3 });
  });
});
