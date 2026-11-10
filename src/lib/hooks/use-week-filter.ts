"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { usePeopleActivity } from "@/lib/hooks/use-people-activity";
import { useScheduleTimezone } from "@/lib/hooks/use-schedule-data";
import { schedulablePeople } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { type FilterPerson, filterPeople } from "@/lib/week-grid/filter";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

interface WeekFilterState {
  people: FilterPerson[];
  /** Whether people are sorted into activity groups yet; false until `load` settles. */
  grouped: boolean;
  selected: Option<FilterPerson>;
  select: (userId: Id) => void;
  clear: () => void;
  /** Asks for activity around now; later calls keep the first answer. */
  load: () => void;
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
  const timezone = useScheduleTimezone();
  const [around, setAround] = useState<Option<DateTime>>(None);
  const load = useCallback(
    () => setAround((prev) => (prev.some ? prev : Some(DateTime.now().setZone(timezone)))),
    [timezone]
  );
  const { activity, isLoading: activityLoading } = usePeopleActivity(userId, entries, around, timezone);
  const grouped = around.some && !activityLoading;
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

  return { people, grouped, selected, select, clear, load };
}
