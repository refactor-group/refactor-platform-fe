import type { DateTime } from "ts-luxon";
import { sessionStartIn, shortDate } from "@/lib/session-window";
import { getCoacheeName } from "@/lib/utils/relationship";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";

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

/** e.g. "Created a new session Nov 4 @ 10 AM with James Hodapp". */
export function sessionCreatedMessage(
  session: SessionRef,
  relationships: CoachingRelationshipWithUserNames[],
  timezone: string
): string {
  return `Created a new session ${startsAt(session, timezone)}${withCoachee(relationships, session.coaching_relationship_id)}`;
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

/** e.g. "Created 3 recurring sessions with James Hodapp". */
export function seriesCreatedMessage(
  count: number,
  relationshipId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): string {
  return `Created ${count} recurring session${count === 1 ? "" : "s"}${withCoachee(relationships, relationshipId)}`;
}
