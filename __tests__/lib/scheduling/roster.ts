import { DateTime } from "ts-luxon";
import { toSessionDate } from "@/lib/session-window";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { createMockEnrichedSession, createMockRelationship } from "../../test-utils";

/**
 * A coach ("me") in America/Chicago on Monday, August 17, 2026 at 10:00 AM.
 * Ehab: weekly series, Tuesdays 2:30 PM. Priya: one past, one upcoming, no pattern.
 * Sara: two past Thursdays at 9:00 AM, nothing upcoming. Dana: last seen June 1 (inactive).
 * Boss coaches me, so Boss is never someone I schedule with.
 */
export const ZONE = "America/Chicago";
export const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });
export const NOW = at("2026-08-17T10:00");
export const ME = "me";

interface Person {
  id: string;
  first: string;
  last: string;
}

const DANA: Person = { id: "dana", first: "Dana", last: "Fox" };
const EHAB: Person = { id: "ehab", first: "Ehab", last: "Badawi" };
const PRIYA: Person = { id: "priya", first: "Priya", last: "Raman" };
const SARA: Person = { id: "sara", first: "Sara", last: "Lin" };
const BOSS: Person = { id: "boss", first: "Boss", last: "Person" };

const coaching = (id: string, person: Person): CoachingRelationshipWithUserNames =>
  createMockRelationship({
    id,
    coach_id: ME,
    coachee_id: person.id,
    coach_first_name: "Jim",
    coach_last_name: "Hodapp",
    coachee_first_name: person.first,
    coachee_last_name: person.last,
  });

export const RELATIONSHIPS: CoachingRelationshipWithUserNames[] = [
  coaching("rel-d", DANA),
  coaching("rel-e", EHAB),
  coaching("rel-p", PRIYA),
  coaching("rel-s", SARA),
  createMockRelationship({
    id: "rel-b",
    coach_id: BOSS.id,
    coachee_id: ME,
    coach_first_name: BOSS.first,
    coach_last_name: BOSS.last,
    coachee_first_name: "Jim",
    coachee_last_name: "Hodapp",
  }),
];

const base = createMockEnrichedSession();

function user(person: Person) {
  return {
    ...base.coachee!,
    id: person.id,
    first_name: person.first,
    last_name: person.last,
    display_name: `${person.first} ${person.last}`,
  };
}

interface SessionSpec {
  id: string;
  relationshipId: string;
  person: Person;
  start: string;
  minutes?: number;
  series?: string;
  /** I'm the coachee: `person` is my coach. */
  asCoachee?: boolean;
}

export function session(spec: SessionSpec): EnrichedCoachingSession {
  const me = { ...base.coach!, id: ME, first_name: "Jim", last_name: "Hodapp" };
  const other = user(spec.person);
  return createMockEnrichedSession({
    id: spec.id,
    coaching_relationship_id: spec.relationshipId,
    date: toSessionDate(at(spec.start)),
    duration_minutes: spec.minutes ?? 50,
    coaching_session_series_id: spec.series ? Some(spec.series) : None,
    relationship: {
      ...base.relationship!,
      id: spec.relationshipId,
      coach_id: spec.asCoachee ? spec.person.id : ME,
      coachee_id: spec.asCoachee ? ME : spec.person.id,
    },
    coach: spec.asCoachee ? other : me,
    coachee: spec.asCoachee ? me : other,
  });
}

export const E_04 = session({ id: "e-04", relationshipId: "rel-e", person: EHAB, start: "2026-08-04T14:30", series: "series-e" });
export const E_11 = session({ id: "e-11", relationshipId: "rel-e", person: EHAB, start: "2026-08-11T14:30", series: "series-e" });
export const E_18 = session({ id: "e-18", relationshipId: "rel-e", person: EHAB, start: "2026-08-18T14:30", series: "series-e" });
export const P_10 = session({ id: "p-10", relationshipId: "rel-p", person: PRIYA, start: "2026-08-10T10:00" });
export const P_18 = session({ id: "p-18", relationshipId: "rel-p", person: PRIYA, start: "2026-08-18T16:30" });
export const S_06 = session({ id: "s-06", relationshipId: "rel-s", person: SARA, start: "2026-08-06T09:00" });
export const S_13 = session({ id: "s-13", relationshipId: "rel-s", person: SARA, start: "2026-08-13T09:00" });
export const D_01 = session({ id: "d-01", relationshipId: "rel-d", person: DANA, start: "2026-06-01T10:00" });

/** What `/nearest` returns around now: the last and next session per relationship. */
export const NEAREST = [E_11, E_18, P_10, P_18, S_13, D_01];

/** Every session in the fetched ranges. */
export const ALL = [E_04, E_11, E_18, P_10, P_18, S_06, S_13, D_01];
