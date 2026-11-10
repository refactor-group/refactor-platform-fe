import { type PersonEntry, matchesPersonName } from "@/lib/people";
import { type PersonActivity, isInactive } from "@/lib/person-activity";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

export enum PersonGroup {
  Coachees = "coachees",
  Inactive = "inactive",
}

export interface FilterPerson {
  userId: Id;
  fullName: string;
  relationshipIds: Id[];
  group: PersonGroup;
}

export interface FilterSection {
  group: PersonGroup;
  label: string;
  people: FilterPerson[];
}

const GROUP_ORDER: PersonGroup[] = [PersonGroup.Coachees, PersonGroup.Inactive];

function groupLabel(group: PersonGroup): string {
  switch (group) {
    case PersonGroup.Coachees:
      return "Coachees";
    case PersonGroup.Inactive:
      return "Inactive";
    default: {
      const _exhaustive: never = group;
      throw new Error(`Unhandled person group: ${_exhaustive}`);
    }
  }
}

function groupOf(userId: Id, activity: Option<Map<Id, PersonActivity>>): PersonGroup {
  if (activity.none) return PersonGroup.Coachees;
  const theirs = activity.val.get(userId);
  return theirs !== undefined && isInactive(theirs) ? PersonGroup.Inactive : PersonGroup.Coachees;
}

export function filterPeople(
  people: PersonEntry[],
  activity: Option<Map<Id, PersonActivity>>
): FilterPerson[] {
  return people.map(({ person, relationshipIds }) => ({
    userId: person.userId,
    fullName: person.fullName,
    relationshipIds,
    group: groupOf(person.userId, activity),
  }));
}

export function filterSections(people: FilterPerson[], query: string): FilterSection[] {
  return GROUP_ORDER.map((group) => ({
    group,
    label: groupLabel(group),
    people: people.filter((p) => p.group === group && matchesPersonName(p.fullName, query)),
  })).filter((section) => section.people.length > 0);
}

export function isFilteredOut(session: EnrichedCoachingSession, selected: Option<FilterPerson>): boolean {
  return selected.some && !selected.val.relationshipIds.includes(session.coaching_relationship_id);
}

export function filterLabel(selected: Option<FilterPerson>): string {
  return selected.some ? selected.val.fullName : "All sessions";
}
