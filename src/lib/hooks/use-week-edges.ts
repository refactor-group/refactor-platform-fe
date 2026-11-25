import { nearestEachQuery, useNearestEachCoachingSessions } from "@/lib/api/coaching-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useViewerRelationshipIds } from "@/lib/hooks/use-viewer-relationship-ids";
import { utcInstant } from "@/lib/session-window";
import { weekEdges, type Week, type WeekEdges } from "@/lib/week-grid/week";

const UNKNOWN_EDGES: WeekEdges = { hasEarlier: true };

export function useWeekEdges(week: Week): WeekEdges {
  const userId = useAuthStore((s) => s.userId);
  const viewer = useViewerRelationshipIds();

  const aroundStart = useNearestEachCoachingSessions(
    nearestEachQuery(userId, viewer.relationshipIds, utcInstant(week.start))
  );

  const settled = [viewer, aroundStart].every((r) => !r.isLoading && !r.isError);
  return settled ? weekEdges(aroundStart.sessions, week) : UNKNOWN_EDGES;
}
