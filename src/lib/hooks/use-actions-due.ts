"use client";

import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useUserTimezone } from "@/lib/hooks/use-user-timezone";
import {
  SESSION_LIST_LOOKAHEAD,
  SESSION_LIST_LOOKBACK,
  actionsDueAt,
  previousSessionOf,
  summarizeActionsDue,
  type ActionsDueSummary,
} from "@/lib/actions-due";
import { UserActionsScope } from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import type { Option } from "@/types/option";

export interface ActionsDue {
  due: Action[];
  summary: ActionsDueSummary;
  previous: Option<CoachingSession>;
  isLoading: boolean;
  isError: boolean;
}

/** Actions due at `session`, fetched with the same SWR keys as the session page's Actions panel. */
export function useActionsDue(
  session: CoachingSession,
  viewerId: Id,
  now: DateTime
): ActionsDue {
  const timezone = useUserTimezone();

  const {
    actions,
    isLoading: actionsLoading,
    isError: actionsError,
  } = useUserActionsList(viewerId, {
    scope: UserActionsScope.Sessions,
    coaching_relationship_id: session.coaching_relationship_id,
  });

  // Frozen at mount, matching the panel's window.
  const fromDate = useMemo(() => DateTime.now().minus(SESSION_LIST_LOOKBACK), []);
  const toDate = useMemo(() => DateTime.now().plus(SESSION_LIST_LOOKAHEAD), []);

  const {
    coachingSessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useCoachingSessionList(
    session.coaching_relationship_id,
    fromDate,
    toDate,
    "date",
    "asc"
  );

  const due = useMemo(
    () => actionsDueAt(actions, coachingSessions, session.id, timezone),
    [actions, coachingSessions, session.id, timezone]
  );

  const previous = useMemo(
    () => previousSessionOf(coachingSessions, session.id),
    [coachingSessions, session.id]
  );

  const summary = useMemo(
    () => summarizeActionsDue(due, now.setZone(timezone)),
    [due, now, timezone]
  );

  return {
    due,
    summary,
    previous,
    isLoading: Boolean(actionsLoading || sessionsLoading),
    isError: Boolean(actionsError || sessionsError),
  };
}
