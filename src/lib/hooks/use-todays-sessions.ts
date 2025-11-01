import { useState } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { useInterval } from "@/lib/hooks/use-interval";

/**
 * Hook to fetch today's coaching sessions - ENHANCED VERSION
 *
 * Uses the new backend endpoint that supports batch loading of related data
 * in a single API call, eliminating N+1 queries and multiple round trips.
 *
 * Returns raw CoachingSession objects - display values should be computed on-the-fly.
 */
export function useTodaysSessions() {
  // Get current user
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const userId = userSession?.id;
  const timezone = userSession?.timezone || getBrowserTimezone();

  // Calculate today's date range in user's timezone
  const today = DateTime.now().setZone(timezone);
  const startOfDay = today.startOf("day");
  const endOfDay = today.endOf("day");

  // Convert to UTC for backend date filtering
  // The backend stores timestamps in UTC but we need sessions that fall within
  // "today" in the user's local timezone
  const startOfDayUTC = startOfDay.toUTC();
  const endOfDayUTC = endOfDay.toUTC();

  // Force re-render every 30 seconds to update urgency messages in real-time
  const [tick, setTick] = useState(0);
  useInterval(() => {
    setTick(prev => prev + 1);
  }, 30000);

  // Fetch sessions with all related data in ONE API call
  // Use UTC dates for backend filtering since backend stores timestamps in UTC
  const { enrichedSessions, isLoading, isError, refresh } =
    useEnrichedCoachingSessionsForUser(
      userId || null,
      startOfDayUTC,
      endOfDayUTC,
      [
        CoachingSessionInclude.Relationship,
        CoachingSessionInclude.Organization,
        CoachingSessionInclude.Goal,
      ],
      "date",
      "asc"
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
