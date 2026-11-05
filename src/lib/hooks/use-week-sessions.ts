import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import type { Week } from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export interface WeekSessions {
  sessions: EnrichedCoachingSession[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}

const WEEK_INCLUDES = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Series,
  CoachingSessionInclude.Topics,
];

/** The viewer's sessions for one week, Monday through Sunday in the week's zone. */
export function useWeekSessions(week: Week): WeekSessions {
  const userId = useAuthStore((s) => s.userId);
  const { currentOrganizationId } = useCurrentOrganization();

  // Fetching before the organization is known would briefly show every organization's sessions.
  const { enrichedSessions, isLoading, isError, refresh } = useEnrichedCoachingSessionsForUser(
    currentOrganizationId ? userId : null,
    week.days[0],
    week.days[6],
    WEEK_INCLUDES,
    "date",
    "asc",
    undefined,
    week.start.zoneName,
    currentOrganizationId ?? undefined
  );

  return { sessions: enrichedSessions, isLoading, isError, refresh };
}
