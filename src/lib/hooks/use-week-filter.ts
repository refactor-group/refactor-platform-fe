"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useNearestEachCoachingSessions } from "@/lib/api/coaching-sessions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useScheduleTimezone } from "@/lib/hooks/use-schedule-data";
import { type PersonEntry, activityByPerson, schedulablePeople } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { utcInstant } from "@/lib/session-window";
import { type FilterPerson, filterPeople } from "@/lib/week-grid/filter";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

interface WeekFilterState {
  people: FilterPerson[];
  selected: Option<FilterPerson>;
  select: (userId: Id) => void;
  clear: () => void;
}

function usePersonActivity(userId: Id, entries: PersonEntry[]) {
  const timezone = useScheduleTimezone();
  const [openedAt] = useState(() => DateTime.now().setZone(timezone));
  const nearest = useNearestEachCoachingSessions(
    entries.length > 0
      ? Some({
          userId,
          relationshipIds: entries.flatMap((e) => e.relationshipIds),
          around: utcInstant(openedAt),
          fetchedFor: String(openedAt.toMillis()),
        })
      : None
  );
  const settled = !nearest.isLoading && !nearest.isError;
  return useMemo(
    () => (settled ? Some(activityByPerson(entries, nearest.sessions, openedAt, timezone)) : None),
    [settled, entries, nearest.sessions, openedAt, timezone]
  );
}

function resolve(people: FilterPerson[], id: Option<Id>): Option<FilterPerson> {
  if (id.none) return None;
  const person = people.find((p) => p.userId === id.val);
  return person ? Some(person) : None;
}

export function useWeekFilter(): WeekFilterState {
  const userId = useAuthStore((s) => s.userId);
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships, isLoading, isError } = useCoachingRelationshipList(currentOrganizationId);
  const entries = useMemo(() => schedulablePeople(userId, relationships), [userId, relationships]);
  const activity = usePersonActivity(userId, entries);
  const people = useMemo(() => filterPeople(entries, activity), [entries, activity]);

  const personFilter = useWeekGridStore((s) => s.personFilter);
  const select = useWeekGridStore((s) => s.setPersonFilter);
  const clear = useWeekGridStore((s) => s.clearPersonFilter);
  const selected = useMemo(() => resolve(people, personFilter), [people, personFilter]);

  const loaded = !isLoading && !isError;
  const stale = loaded && personFilter.some && selected.none;
  useEffect(() => {
    if (stale) clear();
  }, [stale, clear]);

  return { people, selected, select, clear };
}
