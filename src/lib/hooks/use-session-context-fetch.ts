import { useMemo } from "react";
import { getOneYearAgo, getOneYearFromNow } from "@/lib/utils/date";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import {
  buildSessionLookupMaps,
} from "@/lib/utils/assigned-actions";
import type { SessionLookupMaps } from "@/lib/utils/assigned-actions";

/**
 * Fetches enriched coaching sessions for a user and builds lookup maps
 * used to add context (relationship, goal, session info) to actions.
 *
 * @param userId - The current user's ID, or null to skip fetching
 */
export function useSessionContextFetch(userId: string | null) {
  const oneYearAgo = useMemo(() => getOneYearAgo(), []);
  const oneYearFromNow = useMemo(() => getOneYearFromNow(), []);

  const {
    enrichedSessions: sessions,
    isLoading,
    isError,
  } = useEnrichedCoachingSessionsForUser(userId, oneYearAgo, oneYearFromNow, [
    CoachingSessionInclude.Relationship,
    CoachingSessionInclude.Goal,
  ]);

  const lookupMaps: SessionLookupMaps = useMemo(
    () => buildSessionLookupMaps(sessions ?? []),
    [sessions]
  );

  return { lookupMaps, isLoading, isError };
}
