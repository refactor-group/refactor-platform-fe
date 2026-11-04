import type { DateTime } from "ts-luxon";
import type { RepeatChoice } from "@/lib/scheduling";
import { firstNameOf, repeatLabel, shortDay } from "@/lib/scheduling-copy";
import { sessionStartIn, shortDate, timeOfDay } from "@/lib/session-window";
import { formatWeekdayDate } from "@/lib/utils/date";
import { getCoacheeName } from "@/lib/utils/relationship";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

/** " with James Hodapp", or nothing if the relationship isn't loaded. */
function withCoachee(relationships: CoachingRelationshipWithUserNames[], relationshipId: Id): string {
  const relationship = relationships.find((r) => r.id === relationshipId);
  return relationship ? ` with ${getCoacheeName(relationship)}` : "";
}

type SessionRef = { date: string; coaching_relationship_id: Id };

/** "11 AM" on the hour, else "11:30 AM". */
function clockTime(start: DateTime): string {
  return start.toFormat(start.minute === 0 ? "h a" : "h:mm a");
}

/** "Nov 4 @ 11 AM", in the user's timezone. */
function startsAt(session: SessionRef, timezone: string): string {
  const start = sessionStartIn(session.date, timezone);
  return `${shortDate(start)} @ ${clockTime(start)}`;
}

/** "the Nov 4 @ 11 AM session with James Hodapp". */
function theSession(
  session: SessionRef,
  relationships: CoachingRelationshipWithUserNames[],
  timezone: string
): string {
  return `the ${startsAt(session, timezone)} session${withCoachee(relationships, session.coaching_relationship_id)}`;
}

/** e.g. "Updated the Nov 6 @ 11 AM session with James Hodapp", with its new date and time. */
export function sessionUpdatedMessage(
  session: SessionRef,
  relationships: CoachingRelationshipWithUserNames[],
  timezone: string
): string {
  return `Updated ${theSession(session, relationships, timezone)}`;
}

/** e.g. "Removed the Nov 4 @ 11 AM session with James Hodapp". */
export function sessionRemovedMessage(
  session: SessionRef,
  relationships: CoachingRelationshipWithUserNames[],
  timezone: string
): string {
  return `Removed ${theSession(session, relationships, timezone)}`;
}

export interface OtherMove {
  personName: string;
  start: DateTime;
}

/** "Priya moves to Wed 19, 3:30 PM". */
function otherMoveParts(otherMove: Option<OtherMove>): string[] {
  if (otherMove.none) return [];
  const { personName, start } = otherMove.val;
  return [`${firstNameOf(personName)} moves to ${shortDay(start)}, ${timeOfDay(start)}`];
}

/** e.g. "Scheduled · Ehab Badawi · Tuesday, August 18 · 2:30 PM · 50 min · Weekly, for 8 sessions". */
export function scheduledMessage(input: {
  personName: string;
  start: DateTime;
  minutes: number;
  repeat: RepeatChoice;
  otherMove: Option<OtherMove>;
}): string {
  const { personName, start, minutes, repeat, otherMove } = input;
  return [
    "Scheduled",
    personName,
    formatWeekdayDate(start),
    timeOfDay(start),
    `${minutes} min`,
    ...(repeat.kind === "repeat" ? [repeatLabel(repeat)] : []),
    ...otherMoveParts(otherMove),
  ].join(" · ");
}

export function otherMoveFailedMessage(personName: string): string {
  return `Couldn't move ${firstNameOf(personName)}'s session · Reschedule it from the dashboard`;
}

/** e.g. "Rescheduled · Ehab to Thursday, August 20, 2:00 PM · and following". */
export function rescheduledMessage(input: {
  personName: string;
  start: DateTime;
  following: boolean;
  otherMove: Option<OtherMove>;
}): string {
  const { personName, start, following, otherMove } = input;
  return [
    "Rescheduled",
    `${firstNameOf(personName)} to ${formatWeekdayDate(start)}, ${timeOfDay(start)}`,
    ...(following ? ["and following"] : []),
    ...otherMoveParts(otherMove),
  ].join(" · ");
}
