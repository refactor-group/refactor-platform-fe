import type { DateTime } from "ts-luxon";
import type { MenuPerson } from "@/components/ui/join-session/types";
import { type PersonActivity, personActivity } from "@/lib/person-activity";
import { sessionStartIn } from "@/lib/session-window";
import { calculateSessionUrgency } from "@/lib/utils/session";
import {
  type CoachingRelationshipWithUserNames,
  getRelationshipsAsCoach,
  getRelationshipsForUser,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { SessionUrgency } from "@/types/session-display";

/** A person and every relationship the user has with them (two when they coach each other). */
export interface PersonEntry {
  person: MenuPerson;
  relationshipIds: Id[];
}

export function initialsOf(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function menuPerson(userId: Id, first: string, last: string): MenuPerson {
  return {
    userId,
    firstName: first,
    fullName: `${first} ${last}`.trim(),
    initials: initialsOf(first, last),
  };
}

function otherParticipant(rel: CoachingRelationshipWithUserNames, userId: Id): MenuPerson {
  return rel.coach_id === userId
    ? menuPerson(rel.coachee_id, rel.coachee_first_name, rel.coachee_last_name)
    : menuPerson(rel.coach_id, rel.coach_first_name, rel.coach_last_name);
}

/** Case-insensitive substring match on the trimmed query; a blank query matches everyone. */
export function matchesPersonName(fullName: string, query: string): boolean {
  return fullName.toLowerCase().includes(query.trim().toLowerCase());
}

/** One entry per other person, holding each relationship the user has with them. */
export function peopleFor(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): PersonEntry[] {
  const sorted = sortRelationshipsByParticipantName(
    getRelationshipsForUser(userId, relationships),
    userId
  );
  const byPerson = new Map<Id, PersonEntry>();
  for (const rel of sorted) {
    const person = otherParticipant(rel, userId);
    const entry = byPerson.get(person.userId);
    if (entry) entry.relationshipIds.push(rel.id);
    else byPerson.set(person.userId, { person, relationshipIds: [rel.id] });
  }
  return [...byPerson.values()];
}

/** The people the user coaches, in name order. */
export function schedulablePeople(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): PersonEntry[] {
  return peopleFor(userId, getRelationshipsAsCoach(userId, relationships));
}

export type ActivityByPerson = Map<Id, PersonActivity>;

/** Each person's activity from the sessions nearest now across their relationships. */
export function activityByPerson(
  people: PersonEntry[],
  sessions: EnrichedCoachingSession[],
  now: DateTime,
  timezone: string
): ActivityByPerson {
  return new Map(
    people.map(({ person, relationshipIds }) => {
      const theirs = sessions
        .filter((s) => relationshipIds.includes(s.coaching_relationship_id))
        .map((s) => ({
          start: sessionStartIn(s.date, timezone),
          over: calculateSessionUrgency(s) === SessionUrgency.Past,
          relationshipId: s.coaching_relationship_id,
        }));
      return [person.userId, personActivity(theirs, now)];
    })
  );
}
