import type { DateTime } from "ts-luxon";
import type { StepRailItem } from "@/components/ui/step-dialog";
import { type PersonEntry, menuPerson } from "@/lib/people";
import {
  type Availability,
  type ClashState,
  type RuleInput,
  availabilityHint,
  resolveHint,
  rulePayload,
  stepRail,
} from "@/lib/schedule-draft";
import type { MoveScope, RepeatChoice, StepKind } from "@/lib/scheduling";
import { seriesSlotStart, sessionStartIn, toSessionDate } from "@/lib/session-window";
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

/** Moved on its own: it happens away from the occurrence it fills. */
function movedAlone(session: CoachingSession, timezone: string): boolean {
  return (
    session.ical_recurrence_id.some &&
    sessionStartIn(session.date, timezone).toMillis() !== seriesSlotStart(session, timezone).toMillis()
  );
}

/** The rule a this-and-following edit asks for, beside the series' current one. */
export interface FollowingRule {
  frequency: Frequency;
  interval: number;
  byWeekdays: Weekday[];
  current: SeriesRepeat;
}

/** The new rule fills the slots the series already has: same first slot, rhythm and weekdays. */
function sameSlots(anchor: CoachingSession, start: DateTime, rule: FollowingRule, timezone: string): boolean {
  const { current } = rule;
  return (
    seriesSlotStart(anchor, timezone).toMillis() === start.toMillis() &&
    rule.frequency === current.frequency &&
    rule.interval === current.interval &&
    rule.byWeekdays.length === current.byWeekdays.length &&
    rule.byWeekdays.every((day) => current.byWeekdays.includes(day))
  );
}

/**
 * How many sessions a this-and-following reschedule moves (RescheduleSessionAndFollowing v6).
 * With the same slots, only the anchor can move. Otherwise: the anchor, plus each later session
 * that fills one of the new rule's `slots`, unless it was moved on its own to the new start or
 * later. Sessions past the last slot are removed, not moved.
 */
export function followingMoveCount(input: {
  anchor: CoachingSession;
  sessions: CoachingSession[];
  start: DateTime;
  slots: number;
  rule: FollowingRule;
  timezone: string;
}): number {
  const { anchor, sessions, start, slots, rule, timezone } = input;
  const at = (s: CoachingSession) => sessionStartIn(s.date, timezone).toMillis();
  if (sameSlots(anchor, start, rule, timezone)) return at(anchor) === start.toMillis() ? 0 : 1;
  const after = (s: CoachingSession) => at(s) > at(anchor) || (at(s) === at(anchor) && s.id > anchor.id);
  const keepsItsTime = (s: CoachingSession) => movedAlone(s, timezone) && at(s) >= start.toMillis();
  const filled = sessions
    .filter((s) => s.id !== anchor.id && after(s))
    .sort((a, b) => seriesSlotStart(a, timezone).toMillis() - seriesSlotStart(b, timezone).toMillis() || a.id.localeCompare(b.id))
    .slice(0, Math.max(slots - 1, 0));
  return 1 + filled.filter((s) => !keepsItsTime(s)).length;
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
  input: ClashState & { changed: boolean; following: boolean; seriesLoading: boolean; availability: Availability }
): Option<string> {
  // Without the series, the Repeat step shows defaults rather than its rule.
  if (input.following && input.seriesLoading) return Some(SERIES_LOADING_HINT);
  // A rule-only edit of this and following is a valid change.
  if (!input.changed && !input.following) return Some(UNCHANGED_HINT);
  const checking = availabilityHint(input.availability);
  return checking.some ? checking : resolveHint(input);
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
