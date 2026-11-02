import { useState } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { useInterval } from "@/lib/hooks/use-interval";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";

/**
 * Hook to fetch today's coaching sessions.
 *
 * Uses the backend endpoint that supports batch loading of related data
 * in a single API call, eliminating N+1 queries and multiple round trips.
 *
 * @param include - Optional array of related resources to include.
 *   Defaults to Relationship + Organization + Goal.
 */
export function useTodaysSessions(
  include: CoachingSessionInclude[] = [
    CoachingSessionInclude.Relationship,
    CoachingSessionInclude.Organization,
    CoachingSessionInclude.Goal,
  ]
) {
  // Get current user
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const userId = userSession?.id;
  const timezone = userSession?.timezone || getBrowserTimezone();
  const { currentOrganizationId } = useCurrentOrganization();

  // Force re-render every 30 seconds to update urgency messages in real-time
  const [tick, setTick] = useState(0);
  useInterval(() => {
    setTick(prev => prev + 1);
  }, 30000);

  // Today's calendar date in the user's timezone. The API sends dates only, so
  // `tz` makes the backend read it as that local day; UTC dates would cover
  // whichever UTC days the local day overlaps (e.g. tomorrow's sessions in the US).
  const today = DateTime.now().setZone(timezone);

  // TypeScript non-null assertion: middleware guarantees userId exists on protected routes
  // If userId is briefly undefined during hydration, SWR will show loading state
  // A null user id skips the fetch. Waiting for the organization matters as much
  // as sending it: fetching first returns every organization's sessions and the
  // cards render them before the scoped result replaces them.
  const { enrichedSessions, isLoading, isError, refresh } =
    useEnrichedCoachingSessionsForUser(
      currentOrganizationId ? userId! : null,
      today,
      today,
      include,
      "date",
      "asc",
      undefined,
      timezone,
      currentOrganizationId ?? undefined
    );

  return {
    sessions: enrichedSessions || [],
    isLoading,
    error: isError,
    refresh,
    // Include tick to ensure consumers re-render when urgency updates
    _tick: tick,
  };
}
