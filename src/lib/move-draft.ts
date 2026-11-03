import type { DateTime } from "ts-luxon";
import type { StepRailItem } from "@/components/ui/step-dialog";
import { type PersonEntry, menuPerson } from "@/lib/people";
import { type ClashState, type RuleInput, resolveHint, rulePayload, stepRail } from "@/lib/schedule-draft";
import type { MoveScope, RepeatChoice, StepKind } from "@/lib/scheduling";
import { sessionStartIn, toSessionDate } from "@/lib/session-window";
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";
import type { CoachingSessionSeriesWithSessions } from "@/types/coaching-session-series";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { Frequency, type RecurrenceEnd, type RescheduleSeriesRequest, type Weekday } from "@/types/recurrence";

const UNCHANGED_HINT = "Pick a new date or time.";
const SERIES_LOADING_HINT = "Loading the series…";

/** The other participant: their roster entry, else the session's own coach or coachee. */
export function movePerson(session: EnrichedCoachingSession, userId: Id, entries: PersonEntry[]): Option<PersonEntry> {
  const entry = entries.find((e) => e.relationshipIds.includes(session.coaching_relationship_id));
  if (entry) return Some(entry);
  const other = session.relationship?.coach_id === userId ? session.coachee : session.coach;
  if (!other) return None;
  return Some({
    person: menuPerson(other.id, other.first_name, other.last_name),
    relationshipIds: [session.coaching_relationship_id],
  });
}

/** The session's start as "HH:mm" on its day, in `timezone`. */
export function moveStart(session: EnrichedCoachingSession, timezone: string): { day: DateTime; time: string } {
  const start = sessionStartIn(session.date, timezone);
  return { day: start.startOf("day"), time: start.toFormat("HH:mm") };
}

export function startMoved(session: EnrichedCoachingSession, start: DateTime, timezone: string): boolean {
  return start.toMillis() !== sessionStartIn(session.date, timezone).toMillis();
}

export function moveChanged(
  session: EnrichedCoachingSession,
  slot: { start: Option<DateTime>; minutes: number },
  timezone: string
): boolean {
  if (slot.minutes !== session.duration_minutes) return true;
  return slot.start.some && startMoved(session, slot.start.val, timezone);
}

export function moveHint(
  input: ClashState & { changed: boolean; following: boolean; seriesLoading: boolean }
): Option<string> {
  // Without the series, the Repeat step shows defaults rather than its rule.
  if (input.following && input.seriesLoading) return Some(SERIES_LOADING_HINT);
  // A rule-only edit of this and following is a valid change.
  if (!input.changed && !input.following) return Some(UNCHANGED_HINT);
  return resolveHint(input);
}

export function moveRail(
  input: ClashState & {
    order: StepKind[];
    step: StepKind;
    start: Option<DateTime>;
    changed: boolean;
    scope: MoveScope;
    repeat: RepeatChoice;
  }
): StepRailItem[] {
  const { changed, ...rest } = input;
  return stepRail({ ...rest, personName: None, whenDone: changed });
}

/** The Repeat step's starting point when moving this and following. */
export interface SeriesRepeat {
  frequency: Frequency;
  interval: number;
  byWeekdays: Weekday[];
  end: RecurrenceEnd;
}

function startMillis(session: CoachingSession): number {
  return sessionStartIn(session.date, "utc").toMillis();
}

export function seriesRepeatFrom(
  series: CoachingSessionSeriesWithSessions,
  session: CoachingSession
): SeriesRepeat {
  const { frequency, interval, by_weekdays, until } = series.rule.recurrence;
  const from = startMillis(session);
  return {
    ...(frequency === Frequency.Weekly && interval === 2
      ? { frequency: Frequency.Biweekly, interval: 1 }
      : { frequency, interval }),
    byWeekdays: by_weekdays ?? [],
    end: until.some
      ? { kind: "until", until: until.val }
      : { kind: "count", count: series.coaching_sessions.filter((s) => startMillis(s) >= from).length },
  };
}

export function followingPayload(
  input: RuleInput & { sessionId: Id; start: DateTime; minutes: number }
): RescheduleSeriesRequest {
  return {
    coaching_session_id: input.sessionId,
    start_at: toSessionDate(input.start),
    duration_minutes: input.minutes,
    recurrence: rulePayload(input),
  };
}

/** The earliest session starting at or after `now`. */
export function nextUnstartedSession<T extends CoachingSession>(sessions: T[], now: DateTime): Option<T> {
  const [next] = sessions
    .filter((s) => startMillis(s) >= now.toMillis())
    .sort((a, b) => startMillis(a) - startMillis(b));
  return next ? Some(next) : None;
}
