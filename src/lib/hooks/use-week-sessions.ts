import { useMemo } from "react";
import type { DateTime } from "ts-luxon";
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

function shiftWeek(week: Week, weeks: number): Week {
  return { start: week.start.plus({ weeks }), days: week.days.map((day) => day.plus({ weeks })) };
}

export interface AdjacentWeeks {
  sessions: EnrichedCoachingSession[];
  /** The span whose sessions are loaded: the shown week, plus each neighbour that loaded. */
  known: { from: DateTime; to: DateTime };
}

/** Loads the weeks either side of `week`, so paging doesn't wait and a move can be checked across the edge. */
export function useAdjacentWeekSessions(week: Week): AdjacentWeeks {
  const before = useWeekSessions(shiftWeek(week, -1));
  const after = useWeekSessions(shiftWeek(week, 1));
  const beforeLoaded = !before.isLoading && !before.isError;
  const afterLoaded = !after.isLoading && !after.isError;
  return useMemo(() => {
    const weekEnd = week.start.plus({ weeks: 1 });
    return {
      sessions: [...(beforeLoaded ? before.sessions : []), ...(afterLoaded ? after.sessions : [])],
      known: {
        from: beforeLoaded ? week.start.minus({ weeks: 1 }) : week.start,
        to: afterLoaded ? weekEnd.plus({ weeks: 1 }) : weekEnd,
      },
    };
  }, [week.start, before.sessions, after.sessions, beforeLoaded, afterLoaded]);
}
