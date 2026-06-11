import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { Frequency, Weekday } from "@/types/recurrence";
import { Some, None } from "@/types/option";
import { defaultCoachingSession } from "@/types/coaching-session";
import {
  CoachingSessionSeriesRaw,
  CoachingSessionSeriesWithSessionsRaw,
  SeriesRule,
  defaultCoachingSessionSeries,
  defaultCoachingSessionSeriesWithSessions,
  formatSeriesRule,
  isCoachingSessionSeries,
  parseCoachingSessionSeries,
  parseCoachingSessionSeriesWithSessions,
  seriesRecurrenceToEnd,
} from "@/types/coaching-session-series";

// A count-based weekly rule, matching the backend wire shape where the unused
// end-condition (`until` here) is serialized as explicit null, not omitted.
function rawSeries(
  overrides?: Partial<CoachingSessionSeriesRaw>
): CoachingSessionSeriesRaw {
  return {
    id: "series-1",
    coaching_relationship_id: "rel-1",
    created_by_user_id: "user-1",
    rule: {
      start_at: "2026-05-15T10:00:00",
      duration_minutes: 60,
      recurrence: {
        frequency: Frequency.Weekly,
        interval: 1,
        by_weekdays: [Weekday.Mon, Weekday.Wed],
        count: 24,
        until: null,
      },
    },
    created_at: "2026-05-01T08:00:00+00:00",
    updated_at: "2026-05-02T09:30:00+00:00",
    ...overrides,
  };
}

describe("parseCoachingSessionSeries", () => {
  it("passes scalar fields through unchanged", () => {
    const result = parseCoachingSessionSeries(rawSeries());

    expect(result.id).toBe("series-1");
    expect(result.coaching_relationship_id).toBe("rel-1");
    expect(result.created_by_user_id).toBe("user-1");
    expect(result.rule.start_at).toBe("2026-05-15T10:00:00");
    expect(result.rule.duration_minutes).toBe(60);
    expect(result.rule.recurrence.frequency).toBe(Frequency.Weekly);
    expect(result.rule.recurrence.interval).toBe(1);
    expect(result.rule.recurrence.by_weekdays).toEqual([
      Weekday.Mon,
      Weekday.Wed,
    ]);
  });

  it("lifts a present count to Some and a null until to None", () => {
    const result = parseCoachingSessionSeries(rawSeries());

    expect(result.rule.recurrence.count.some).toBe(true);
    expect(result.rule.recurrence.count.some && result.rule.recurrence.count.val).toBe(24);
    expect(result.rule.recurrence.until.none).toBe(true);
  });

  it("lifts a present until to Some and a null count to None", () => {
    const result = parseCoachingSessionSeries(
      rawSeries({
        rule: {
          start_at: "2026-05-15T10:00:00",
          duration_minutes: 45,
          recurrence: {
            frequency: Frequency.Weekly,
            interval: 2,
            by_weekdays: [Weekday.Mon],
            count: null,
            until: "2026-08-15",
          },
        },
      })
    );

    expect(result.rule.recurrence.count.none).toBe(true);
    expect(result.rule.recurrence.until.some).toBe(true);
    expect(
      result.rule.recurrence.until.some && result.rule.recurrence.until.val
    ).toBe("2026-08-15");
  });

  it("treats an omitted (not just null) count/until as None", () => {
    const raw = rawSeries();
    // Backend may omit the unused end-condition entirely rather than send null.
    delete raw.rule.recurrence.until;
    const result = parseCoachingSessionSeries(raw);

    expect(result.rule.recurrence.until.none).toBe(true);
    expect(result.rule.recurrence.count.some).toBe(true);
  });

  it("omits by_weekdays when absent rather than emitting undefined", () => {
    const raw = rawSeries();
    delete raw.rule.recurrence.by_weekdays;

    const result = parseCoachingSessionSeries(raw);

    expect("by_weekdays" in result.rule.recurrence).toBe(false);
  });

  it("parses created_at/updated_at ISO strings into valid DateTimes", () => {
    const result = parseCoachingSessionSeries(rawSeries());

    expect(DateTime.isDateTime(result.created_at)).toBe(true);
    expect(result.created_at.isValid).toBe(true);
    expect(result.created_at.toUTC().toISO()).toBe(
      DateTime.fromISO("2026-05-01T08:00:00+00:00").toUTC().toISO()
    );
    expect(result.updated_at.isValid).toBe(true);
  });
});

describe("parseCoachingSessionSeriesWithSessions", () => {
  it("includes the materialized sessions alongside the parsed series", () => {
    const sessions = [
      { ...defaultCoachingSession(), id: "cs-1" },
      { ...defaultCoachingSession(), id: "cs-2" },
    ];
    const raw: CoachingSessionSeriesWithSessionsRaw = {
      series: rawSeries(),
      sessions,
    };

    const result = parseCoachingSessionSeriesWithSessions(raw);

    expect(result.id).toBe("series-1");
    expect(result.rule.recurrence.count.some).toBe(true);
    expect(result.coaching_sessions).toHaveLength(2);
    expect(result.coaching_sessions.map((s) => s.id)).toEqual(["cs-1", "cs-2"]);
  });
});

describe("isCoachingSessionSeries", () => {
  it("accepts a parsed series", () => {
    expect(isCoachingSessionSeries(parseCoachingSessionSeries(rawSeries()))).toBe(
      true
    );
  });

  it("rejects non-objects and shapes missing required keys", () => {
    expect(isCoachingSessionSeries(null)).toBe(false);
    expect(isCoachingSessionSeries("series")).toBe(false);
    expect(isCoachingSessionSeries({ id: "x" })).toBe(false);
  });
});

describe("defaults", () => {
  it("produces a None/None recurrence with no sessions", () => {
    const base = defaultCoachingSessionSeries();
    expect(base.rule.recurrence.count.none).toBe(true);
    expect(base.rule.recurrence.until.none).toBe(true);

    expect(defaultCoachingSessionSeriesWithSessions().coaching_sessions).toEqual(
      []
    );
  });
});

describe("formatSeriesRule", () => {
  function rule(overrides: Partial<SeriesRule["recurrence"]>): SeriesRule {
    return {
      start_at: "2026-05-15T10:00:00",
      duration_minutes: 60,
      recurrence: {
        frequency: Frequency.Weekly,
        interval: 1,
        count: Some(24),
        until: None,
        ...overrides,
      },
    };
  }

  it("summarizes a weekly count-based rule with weekdays", () => {
    expect(
      formatSeriesRule(rule({ by_weekdays: [Weekday.Mon, Weekday.Wed] }))
    ).toBe("Weekly on Mon, Wed · 24 sessions");
  });

  it("summarizes an until-based rule with a formatted date", () => {
    expect(
      formatSeriesRule(
        rule({
          frequency: Frequency.Biweekly,
          by_weekdays: [Weekday.Mon],
          count: None,
          until: Some("2026-08-15"),
        })
      )
    ).toBe("Bi-weekly on Mon · until Aug 15, 2026");
  });

  it("uses 'Every N <unit>' phrasing when interval > 1 and singularizes one session", () => {
    expect(
      formatSeriesRule(rule({ frequency: Frequency.Daily, interval: 2, count: Some(1) }))
    ).toBe("Every 2 days · 1 session");
  });

  it("omits the weekday clause when there are no weekdays", () => {
    expect(
      formatSeriesRule(rule({ frequency: Frequency.Monthly, count: Some(6) }))
    ).toBe("Monthly · 6 sessions");
  });
});

describe("seriesRecurrenceToEnd", () => {
  const base = {
    frequency: Frequency.Weekly,
    interval: 1,
  };

  it("maps a count-based recurrence to a count end", () => {
    expect(
      seriesRecurrenceToEnd({ ...base, count: Some(12), until: None })
    ).toEqual({ kind: "count", count: 12 });
  });

  it("maps an until-based recurrence to an until end", () => {
    expect(
      seriesRecurrenceToEnd({ ...base, count: None, until: Some("2026-08-15") })
    ).toEqual({ kind: "until", until: "2026-08-15" });
  });

  it("falls back to a 4-occurrence count when neither bound is set", () => {
    expect(
      seriesRecurrenceToEnd({ ...base, count: None, until: None })
    ).toEqual({ kind: "count", count: 4 });
  });
});
