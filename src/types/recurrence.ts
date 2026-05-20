// Mirrors the backend payload for POST /coaching_sessions/recurring.
// Field rules (enforced server-side, see also client-side guards in
// coaching-session-form.tsx):
// - start_at: first occurrence equals start_at, stored UTC
// - interval: step multiplier (weekly + interval:2 ≡ biweekly + interval:1)
// - by_weekdays: weekly/biweekly only; must include start_at's weekday
// - count/until: exactly one must be set
// - caps: ≤ 365 occurrences AND ≤ 366 days of span

import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

export enum Frequency {
  Daily = "daily",
  Weekly = "weekly",
  Biweekly = "biweekly",
  Monthly = "monthly",
}

export enum Weekday {
  Mon = "Mon",
  Tue = "Tue",
  Wed = "Wed",
  Thu = "Thu",
  Fri = "Fri",
  Sat = "Sat",
  Sun = "Sun",
}

export const WEEKDAYS_ORDERED: readonly Weekday[] = [
  Weekday.Mon,
  Weekday.Tue,
  Weekday.Wed,
  Weekday.Thu,
  Weekday.Fri,
  Weekday.Sat,
  Weekday.Sun,
];

// Luxon DateTime.weekday is 1..7 with 1 = Monday.
const LUXON_WEEKDAY_TO_WEEKDAY: readonly Weekday[] = WEEKDAYS_ORDERED;

export function weekdayFromLuxon(luxonWeekday: number): Weekday {
  const index = luxonWeekday - 1;
  const weekday = LUXON_WEEKDAY_TO_WEEKDAY[index];
  if (!weekday) {
    throw new Error(`Invalid Luxon weekday: ${luxonWeekday}`);
  }
  return weekday;
}

export function weekdayLabel(weekday: Weekday): string {
  switch (weekday) {
    case Weekday.Mon:
      return "Mon";
    case Weekday.Tue:
      return "Tue";
    case Weekday.Wed:
      return "Wed";
    case Weekday.Thu:
      return "Thu";
    case Weekday.Fri:
      return "Fri";
    case Weekday.Sat:
      return "Sat";
    case Weekday.Sun:
      return "Sun";
    default: {
      const _exhaustive: never = weekday;
      throw new Error(`Unhandled weekday: ${_exhaustive}`);
    }
  }
}

export function frequencyLabel(frequency: Frequency): string {
  switch (frequency) {
    case Frequency.Daily:
      return "Daily";
    case Frequency.Weekly:
      return "Weekly";
    case Frequency.Biweekly:
      return "Bi-weekly";
    case Frequency.Monthly:
      return "Monthly";
    default: {
      const _exhaustive: never = frequency;
      throw new Error(`Unhandled frequency: ${_exhaustive}`);
    }
  }
}

export function frequencySupportsWeekdays(frequency: Frequency): boolean {
  return frequency === Frequency.Weekly || frequency === Frequency.Biweekly;
}

// Discriminated union for the end-condition UI. The backend wants exactly
// one of `count` or `until`; modeling that as a union eliminates the
// "both/neither" illegal states at the type level.
export type RecurrenceEnd =
  | { kind: "count"; count: number }
  | { kind: "until"; until: string };

export interface Recurrence {
  frequency: Frequency;
  interval?: number;
  by_weekdays?: Weekday[];
  count?: number;
  until?: string;
}

export interface CreateRecurringSessionRequest {
  coaching_relationship_id: Id;
  start_at: string;
  recurrence: Recurrence;
}

export function recurrenceToPayload(
  frequency: Frequency,
  interval: number,
  byWeekdays: Weekday[],
  end: RecurrenceEnd
): Recurrence {
  const recurrence: Recurrence = { frequency };
  if (interval > 1) {
    recurrence.interval = interval;
  }
  if (frequencySupportsWeekdays(frequency) && byWeekdays.length > 0) {
    // Preserve the canonical Mon–Sun order regardless of selection order.
    recurrence.by_weekdays = WEEKDAYS_ORDERED.filter((d) =>
      byWeekdays.includes(d)
    );
  }
  if (end.kind === "count") {
    recurrence.count = end.count;
  } else {
    recurrence.until = end.until;
  }
  return recurrence;
}

// Backend caps the expanded series. Mirroring them here so callers can
// surface inline guidance before submission instead of waiting for a 422.
export const MAX_OCCURRENCES = 365;
export const MAX_SPAN_DAYS = 366;

// UX-only guardrail on the "every N <unit>" input. Not a backend rule — the
// real cap is `MAX_OCCURRENCES` × `MAX_SPAN_DAYS` enforced at submit time. 52
// reads sensibly across all frequencies (≈ once a year for weekly).
export const MAX_INTERVAL = 52;

export interface ValidateRecurrenceInput {
  frequency: Frequency;
  interval: number;
  byWeekdays: Weekday[];
  end: RecurrenceEnd;
  /** First-session start in the user's timezone; null if no date is picked yet. */
  start: DateTime | null;
  /** First-session weekday; null if no date is picked yet. */
  startWeekday: Weekday | null;
  /** User's timezone — `end.until` is parsed against the same wall clock as `start`. */
  timezone: string;
}

export function validateRecurrence({
  frequency,
  interval,
  byWeekdays,
  end,
  start,
  startWeekday,
  timezone,
}: ValidateRecurrenceInput): string | null {
  if (interval < 1) return "Interval must be at least 1.";
  if (end.kind === "count") {
    if (!Number.isInteger(end.count) || end.count < 1) {
      return "Number of occurrences must be at least 1.";
    }
    if (end.count > MAX_OCCURRENCES) {
      return `Maximum ${MAX_OCCURRENCES} occurrences.`;
    }
  } else {
    if (!end.until) return "Pick an end date.";
    if (start) {
      const startOfDay = start.startOf("day");
      const until = DateTime.fromISO(end.until, { zone: timezone }).startOf(
        "day"
      );
      if (!until.isValid) return "End date is invalid.";
      if (until < startOfDay) {
        return "End date must be on or after the first session.";
      }
      const spanDays = Math.floor(until.diff(startOfDay, "days").days) + 1;
      if (spanDays > MAX_SPAN_DAYS) {
        return `End date is beyond the ${MAX_SPAN_DAYS}-day window.`;
      }
    }
  }
  if (frequencySupportsWeekdays(frequency)) {
    if (byWeekdays.length === 0) {
      return "Pick at least one day of the week.";
    }
    if (startWeekday && !byWeekdays.includes(startWeekday)) {
      return `Include ${weekdayLabel(startWeekday)}, which is your first session's day.`;
    }
  }
  return null;
}
