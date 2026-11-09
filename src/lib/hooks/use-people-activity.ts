"use client";

import { useMemo } from "react";
import type { DateTime } from "ts-luxon";
import { useNearestEachCoachingSessions } from "@/lib/api/coaching-sessions";
import { type ActivityByPerson, type PersonEntry, activityByPerson } from "@/lib/people";
import { utcInstant } from "@/lib/session-window";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

export interface PeopleActivity {
  activity: Option<ActivityByPerson>;
  isLoading: boolean;
  isError: boolean;
}

/** Each person's activity as of `around`, from the sessions nearest it. Asks nothing while `around` is None. */
export function usePeopleActivity(
  userId: Id,
  entries: PersonEntry[],
  around: Option<DateTime>,
  timezone: string
): PeopleActivity {
  const nearest = useNearestEachCoachingSessions(
    around.some && entries.length > 0
      ? Some({
          userId,
          relationshipIds: entries.flatMap((e) => e.relationshipIds),
          around: utcInstant(around.val),
          fetchedFor: String(around.val.toMillis()),
        })
      : None
  );
  const settled = !nearest.isLoading && !nearest.isError;
  const activity = useMemo(
    () => (settled && around.some ? Some(activityByPerson(entries, nearest.sessions, around.val, timezone)) : None),
    [settled, entries, nearest.sessions, around, timezone]
  );
  return { activity, isLoading: nearest.isLoading, isError: nearest.isError };
}
