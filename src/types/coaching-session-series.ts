import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { Frequency, Weekday } from "@/types/recurrence";
import { type Option, Some, None } from "@/types/option";
import { CoachingSession } from "@/types/coaching-session";
import { FALLBACK_DURATION_MINUTES } from "@/types/coaching-session-duration";

interface RawSeriesRecurrence {
  frequency: Frequency;
  interval: number;
  by_weekdays?: Weekday[];
  count: number | null;
  until: string | null;
}

interface RawSeriesRule {
  start_at: string;
  recurrence: RawSeriesRecurrence;
  duration_minutes: number;
}

export interface RawCoachingSessionSeries {
  id: Id;
  coaching_relationship_id: Id;
  rule: RawSeriesRule;
  created_by_user_id: Id;
  created_at: string;
  updated_at: string;
}

export interface RawCoachingSessionSeriesWithSessions
  extends RawCoachingSessionSeries {
  coaching_sessions: CoachingSession[];
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

function parseSeriesRule(raw: RawSeriesRule): SeriesRule {
  return {
    start_at: raw.start_at,
    duration_minutes: raw.duration_minutes,
    recurrence: {
      frequency: raw.recurrence.frequency,
      interval: raw.recurrence.interval,
      ...(raw.recurrence.by_weekdays
        ? { by_weekdays: raw.recurrence.by_weekdays }
        : {}),
      count: raw.recurrence.count !== null ? Some(raw.recurrence.count) : None,
      until: raw.recurrence.until !== null ? Some(raw.recurrence.until) : None,
    },
  };
}

export function parseCoachingSessionSeries(
  raw: RawCoachingSessionSeries
): CoachingSessionSeries {
  return {
    id: raw.id,
    coaching_relationship_id: raw.coaching_relationship_id,
    created_by_user_id: raw.created_by_user_id,
    rule: parseSeriesRule(raw.rule),
    created_at: DateTime.fromISO(raw.created_at),
    updated_at: DateTime.fromISO(raw.updated_at),
  };
}

export function parseCoachingSessionSeriesWithSessions(
  raw: RawCoachingSessionSeriesWithSessions
): CoachingSessionSeriesWithSessions {
  return {
    ...parseCoachingSessionSeries(raw),
    coaching_sessions: raw.coaching_sessions,
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
