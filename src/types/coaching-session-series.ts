import { DateTime } from "ts-luxon";
import { Id, countOf } from "@/types/general";
import {
  Frequency,
  RecurrenceEnd,
  WEEKDAYS_ORDERED,
  Weekday,
  frequencyLabel,
  utcDateTimeToUntilDate,
  weekdayLabel,
} from "@/types/recurrence";
import { type Option, Some, None } from "@/types/option";
import {
  CoachingSession,
  CoachingSessionWire,
  transformCoachingSession,
} from "@/types/coaching-session";
import { FALLBACK_DURATION_MINUTES } from "@/types/coaching-session-duration";

interface SeriesRecurrenceRaw {
  frequency: Frequency;
  interval: number;
  by_weekdays?: Weekday[] | null;
  count?: number | null;
  until?: string | null;
}

interface SeriesRuleRaw {
  start_at: string;
  recurrence: SeriesRecurrenceRaw;
  duration_minutes: number;
  /** The zone its weekdays are in: the creator's when published. Older rules omit it (UTC). */
  timezone?: string;
}

export interface CoachingSessionSeriesRaw {
  id: Id;
  coaching_relationship_id: Id;
  rule: SeriesRuleRaw;
  created_by_user_id: Id;
  created_at: string;
  updated_at: string;
}

export interface CoachingSessionSeriesWithSessionsRaw {
  series: CoachingSessionSeriesRaw;
  sessions: CoachingSessionWire[];
}

// ─── Domain shapes ───────────────────────────────────────────────────

export interface SeriesRecurrence {
  frequency: Frequency;
  interval: number;
  by_weekdays?: Weekday[];
  count: Option<number>;
  until: Option<string>;
}

export interface SeriesRule {
  start_at: string;
  /** In `timezone`, the rule's own zone; read them with {@link ruleIn}. */
  recurrence: SeriesRecurrence;
  duration_minutes: number;
  /** The zone its weekdays are in: the creator's when published. */
  timezone: string;
}

export interface CoachingSessionSeries {
  id: Id;
  coaching_relationship_id: Id;
  rule: SeriesRule;
  created_by_user_id: Id;
  created_at: DateTime;
  updated_at: DateTime;
}

// POST /coaching_session_series and GET /coaching_session_series/:id both
// return the series together with its materialized sessions, date-sorted.
export interface CoachingSessionSeriesWithSessions extends CoachingSessionSeries {
  coaching_sessions: CoachingSession[];
}

/**
 * The rule with its weekdays as they fall in `timezone` at the slot `at`. The rule keeps them in
 * its own zone, so a series made in Tokyo on Wednesdays at 9:00 AM repeats on Tuesdays in New
 * York. Measured at a real slot, since daylight saving can move the day for some occurrences.
 */
export function ruleIn(rule: SeriesRule, at: DateTime, timezone: string): SeriesRule {
  const weekdays = rule.recurrence.by_weekdays;
  const here = at.setZone(timezone);
  const there = at.setZone(rule.timezone);
  // An unknown zone name can't be converted, so keep the rule's days.
  if (!weekdays || !here.isValid || !there.isValid) return rule;
  // Within a day either way, so a 6 is a -1 across the week's end.
  const days = (((here.weekday - there.weekday) % 7) + 7) % 7;
  if (days === 0) return rule;
  const shifted = new Set(weekdays.map((day) => WEEKDAYS_ORDERED[(WEEKDAYS_ORDERED.indexOf(day) + days) % 7]));
  return {
    ...rule,
    recurrence: { ...rule.recurrence, by_weekdays: WEEKDAYS_ORDERED.filter((day) => shifted.has(day)) },
  };
}

function parseSeriesRule(raw: SeriesRuleRaw, timezone: string): SeriesRule {
  const { recurrence } = raw;
  // count/until are one-of, and the absent one may be null or omitted — treat
  // both as None. `?? null` collapses undefined so the !== null guard covers
  // both cases.
  const count = recurrence.count ?? null;
  const until = recurrence.until ?? null;
  return {
    start_at: raw.start_at,
    duration_minutes: raw.duration_minutes,
    // Older rules omit it; the backend reads those as UTC.
    timezone: raw.timezone ?? "UTC",
    recurrence: {
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      ...(recurrence.by_weekdays
        ? { by_weekdays: recurrence.by_weekdays }
        : {}),
      count: count !== null ? Some(count) : None,
      // `until` is a date in the domain (the form's end-picker). The backend
      // stores it as a naive-UTC end-of-day datetime, so convert it back to the
      // user's local date — inverting `untilDateToUtcDateTime`.
      until: until !== null ? Some(utcDateTimeToUntilDate(until, timezone)) : None,
    },
  };
}

export function parseCoachingSessionSeries(
  raw: CoachingSessionSeriesRaw,
  timezone: string
): CoachingSessionSeries {
  return {
    id: raw.id,
    coaching_relationship_id: raw.coaching_relationship_id,
    created_by_user_id: raw.created_by_user_id,
    rule: parseSeriesRule(raw.rule, timezone),
    created_at: DateTime.fromISO(raw.created_at),
    updated_at: DateTime.fromISO(raw.updated_at),
  };
}

export function parseCoachingSessionSeriesWithSessions(
  raw: CoachingSessionSeriesWithSessionsRaw,
  timezone: string
): CoachingSessionSeriesWithSessions {
  return {
    ...parseCoachingSessionSeries(raw.series, timezone),
    // Normalize each session's wire `title` (string | null) into Option<string>
    // so series sessions honor the CoachingSession contract — otherwise
    // `session.title.some` / `coachingSessionTitle(session)` throw at runtime.
    coaching_sessions: raw.sessions.map(transformCoachingSession),
  };
}

export function defaultCoachingSessionSeries(): CoachingSessionSeries {
  const now = DateTime.now();
  return {
    id: "",
    coaching_relationship_id: "",
    created_by_user_id: "",
    rule: {
      start_at: "",
      duration_minutes: FALLBACK_DURATION_MINUTES,
      timezone: "UTC",
      recurrence: {
        frequency: Frequency.Weekly,
        interval: 1,
        count: None,
        until: None,
      },
    },
    created_at: now,
    updated_at: now,
  };
}

export function defaultCoachingSessionSeriesWithSessions(): CoachingSessionSeriesWithSessions {
  return { ...defaultCoachingSessionSeries(), coaching_sessions: [] };
}

export function isCoachingSessionSeries(
  value: unknown
): value is CoachingSessionSeries {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;
  return (
    typeof object.id === "string" &&
    typeof object.coaching_relationship_id === "string" &&
    typeof object.created_by_user_id === "string" &&
    typeof object.rule === "object" &&
    object.rule !== null
  );
}

function frequencyPhrase(frequency: Frequency, interval: number): string {
  if (interval <= 1) {
    return frequencyLabel(frequency);
  }
  switch (frequency) {
    case Frequency.Daily:
      return `Every ${interval} days`;
    case Frequency.Weekly:
      return `Every ${interval} weeks`;
    case Frequency.Biweekly:
      return `Every ${interval * 2} weeks`;
    case Frequency.Monthly:
      return `Every ${interval} months`;
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unhandled frequency: ${_exhaustive}`);
    }
  }
}

export function seriesRecurrenceToEnd(
  recurrence: SeriesRecurrence
): RecurrenceEnd {
  if (recurrence.count.some) {
    return { kind: "count", count: recurrence.count.val };
  }
  if (recurrence.until.some) {
    return { kind: "until", until: recurrence.until.val };
  }
  return { kind: "count", count: 4 };
}

/** How a series repeats, e.g. "Weekly on Mon, Wed". */
export function seriesRepeatsText(rule: SeriesRule): string {
  const { frequency, interval, by_weekdays } = rule.recurrence;
  const onDays =
    by_weekdays && by_weekdays.length > 0 ? ` on ${by_weekdays.map(weekdayLabel).join(", ")}` : "";
  return `${frequencyPhrase(frequency, interval)}${onDays}`;
}

function sessionCountText(n: number): string {
  return countOf(n, "session");
}

/** When a series ends, e.g. "Until Aug 15, 2026", "After 8 sessions" or "No end date". */
export function seriesEndText(rule: SeriesRule): string {
  const { count, until } = rule.recurrence;
  if (count.some) return `After ${sessionCountText(count.val)}`;
  if (until.some) return `Until ${DateTime.fromISO(until.val).toFormat("LLL d, yyyy")}`;
  return "No end date";
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Renders a series' recurrence rule as a single human-readable line, e.g.
 * "Weekly on Mon, Wed · 24 sessions" or "Bi-weekly on Mon · until Aug 15, 2026".
 */
export function formatSeriesRule(rule: SeriesRule): string {
  const { count } = rule.recurrence;
  const end = count.some ? sessionCountText(count.val) : lowerFirst(seriesEndText(rule));
  return `${seriesRepeatsText(rule)} · ${end}`;
}
