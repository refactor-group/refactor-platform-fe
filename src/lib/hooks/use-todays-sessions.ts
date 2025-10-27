import { useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import {
  EnrichedSessionDisplay,
  SessionUrgency,
} from "@/types/session-display";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
} from "@/lib/sessions/session-utils";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { useInterval } from "@/lib/hooks/use-interval";

/**
 * Hook to fetch today's coaching sessions - ENHANCED VERSION
 *
 * Uses the new backend endpoint that supports batch loading of related data
 * in a single API call, eliminating N+1 queries and multiple round trips.
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

  // Force re-enrichment every 30 seconds to update urgency messages
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

  // Transform enriched API response to display format
  const displaySessions = useMemo((): EnrichedSessionDisplay[] => {
    if (!enrichedSessions || !userSession) {
      return [];
    }

    return enrichedSessions
      .map((session) => {
        // Data is already enriched from the API!
        const relationship = session.relationship;
        const organization = session.organization;
        const goal = session.overarching_goal;

        if (!relationship) {
          // Shouldn't happen if include=relationship was specified
          return null;
        }

        // Determine user's role
        const isCoach = relationship.coach_id === userSession.id;
        const userRole = isCoach ? ("Coach" as const) : ("Coachee" as const);

        // Get the other participant
        const participant = isCoach
          ? relationship.coachee
          : relationship.coach;

        const participantName =
          participant.display_name ||
          `${participant.first_name} ${participant.last_name}`;

        // Format session time
        const sessionTime = DateTime.fromISO(session.date, { zone: "utc" })
          .setZone(timezone);

        // Calculate urgency
        const urgency = calculateSessionUrgency(session);
        const urgencyMessage = getUrgencyMessage(session, urgency, timezone);
        const isPast = urgency === SessionUrgency.Past;

        return {
          id: session.id,
          goalTitle: goal?.title || "Coaching Session",
          participantName,
          userRole,
          dateTime: sessionTime.toFormat("DDDD 'at' t ZZZZ"),
          organizationName: organization?.name || "Unknown organization",
          isPast,
          urgency: {
            type: urgency,
            message: urgencyMessage,
          },
        };
      })
      .filter((session): session is EnrichedSessionDisplay => session !== null)
      .sort((a, b) => {
        // Already sorted by backend with sort_by=date&sort_order=asc
        // But re-sort in case of any edge cases
        const aSession = enrichedSessions.find((s) => s.id === a.id);
        const bSession = enrichedSessions.find((s) => s.id === b.id);
        if (!aSession || !bSession) return 0;

        const aTime = DateTime.fromISO(aSession.date, { zone: "utc" });
        const bTime = DateTime.fromISO(bSession.date, { zone: "utc" });
        return aTime.toMillis() - bTime.toMillis();
      });
  }, [enrichedSessions, userSession, timezone, tick]);

  return {
    sessions: displaySessions,
    isLoading,
    error: isError,
    refresh,
  };
}
