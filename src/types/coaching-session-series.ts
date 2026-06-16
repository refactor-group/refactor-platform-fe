import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import {
  CoachingRelationshipWithUserNames,
  isUserCoachInRelationship,
} from "@/types/coaching-relationship";
import {
  Frequency,
  RecurrenceEnd,
  Weekday,
  frequencyLabel,
  utcDateTimeToUntilDate,
  weekdayLabel,
} from "@/types/recurrence";
import { type Option, Some, None } from "@/types/option";
import { CoachingSession } from "@/types/coaching-session";
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
  sessions: CoachingSession[];
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
  recurrence: SeriesRecurrence;
  duration_minutes: number;
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
    coaching_sessions: raw.sessions,
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

/**
 * Whether the current user may manage (reschedule/delete) a series for a given
 * relationship. Series management is coach-only.
 *
 * This is client-side UX gating only — it hides the Reschedule/Delete actions
 * from non-coaches.
 */
export function canManageSeries(
  userId: Id | undefined,
  relationship: CoachingRelationshipWithUserNames | undefined
): boolean {
  return (
    !!userId &&
    !!relationship &&
    isUserCoachInRelationship(userId, relationship)
  );
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

/**
 * Renders a series' recurrence rule as a single human-readable line, e.g.
 * "Weekly on Mon, Wed · 24 sessions" or "Bi-weekly on Mon · until Aug 15, 2026".
 */
export function formatSeriesRule(rule: SeriesRule): string {
  const { recurrence } = rule;
  const base = frequencyPhrase(recurrence.frequency, recurrence.interval);
  const onDays =
    recurrence.by_weekdays && recurrence.by_weekdays.length > 0
      ? ` on ${recurrence.by_weekdays.map(weekdayLabel).join(", ")}`
      : "";

  let end: string;
  if (recurrence.count.some) {
    const n = recurrence.count.val;
    end = `${n} session${n === 1 ? "" : "s"}`;
  } else if (recurrence.until.some) {
    end = `until ${DateTime.fromISO(recurrence.until.val).toFormat("LLL d, yyyy")}`;
  } else {
    end = "no end date";
  }

  return `${base}${onDays} · ${end}`;
}
