import type { DateTime } from "ts-luxon";
import type { StepRailItem } from "@/components/ui/step-dialog";
import { type PersonEntry, menuPerson } from "@/lib/people";
import { type Resolution, resolveHint, stepRail } from "@/lib/schedule-draft";
import type { BusySession, StepKind } from "@/lib/scheduling";
import { sessionStartIn } from "@/lib/session-window";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

const UNCHANGED_HINT = "Pick a new date or time.";

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

export function moveChanged(
  session: EnrichedCoachingSession,
  slot: { start: Option<DateTime>; minutes: number },
  timezone: string
): boolean {
  if (slot.minutes !== session.duration_minutes) return true;
  return slot.start.some && slot.start.val.toMillis() !== sessionStartIn(session.date, timezone).toMillis();
}

export function moveHint(input: {
  changed: boolean;
  clash: Option<BusySession>;
  resolution: Resolution;
}): Option<string> {
  if (!input.changed) return Some(UNCHANGED_HINT);
  return resolveHint(input.clash, input.resolution);
}

export function moveRail(input: {
  order: StepKind[];
  step: StepKind;
  start: Option<DateTime>;
  changed: boolean;
  clash: Option<BusySession>;
  resolution: Resolution;
}): StepRailItem[] {
  const { changed, ...rest } = input;
  return stepRail({ ...rest, personName: None, repeat: { kind: "none" }, whenDone: changed });
}
