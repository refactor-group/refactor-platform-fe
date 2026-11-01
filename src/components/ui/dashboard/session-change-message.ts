import { sessionStartIn, shortDate, timeOfDay } from "@/lib/session-window";
import { getCoacheeName } from "@/lib/utils/relationship";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";

export type SessionChange = "Created" | "Updated" | "Deleted";

/** " with James Hodapp", or nothing if the relationship isn't loaded. */
function withCoachee(relationships: CoachingRelationshipWithUserNames[], relationshipId: Id): string {
  const relationship = relationships.find((r) => r.id === relationshipId);
  return relationship ? ` with ${getCoacheeName(relationship)}` : "";
}

/** e.g. "Created Nov 4 session with James Hodapp at 10:00 AM", in the user's timezone. */
export function sessionChangeMessage(
  change: SessionChange,
  session: { date: string; coaching_relationship_id: Id },
  relationships: CoachingRelationshipWithUserNames[],
  timezone: string
): string {
  const start = sessionStartIn(session.date, timezone);
  const coachee = withCoachee(relationships, session.coaching_relationship_id);
  return `${change} ${shortDate(start)} session${coachee} at ${timeOfDay(start)}`;
}

/** e.g. "Created 3 recurring sessions with James Hodapp". */
export function seriesCreatedMessage(
  count: number,
  relationshipId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): string {
  return `Created ${count} recurring session${count === 1 ? "" : "s"}${withCoachee(relationships, relationshipId)}`;
}
