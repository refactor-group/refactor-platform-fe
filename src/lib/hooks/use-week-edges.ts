import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useNearestEachCoachingSessions, type NearestEachQuery } from "@/lib/api/coaching-sessions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { peopleFor } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { utcInstant } from "@/lib/session-window";
import { weekEdges, type Week, type WeekEdges } from "@/lib/week-grid/week";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

const UNKNOWN_EDGES: WeekEdges = { hasEarlier: true, hasLater: true };

export function useWeekEdges(week: Week): WeekEdges {
  const userId = useAuthStore((s) => s.userId);
  const { currentOrganizationId } = useCurrentOrganization();
  const relationshipList = useCoachingRelationshipList(currentOrganizationId);
  const { relationships } = relationshipList;
  const relationshipIds = peopleFor(userId, relationships).flatMap((p) => p.relationshipIds);

  const aroundStart = useNearestEachCoachingSessions(
    nearestQuery(userId, relationshipIds, utcInstant(week.start))
  );
  const aroundEnd = useNearestEachCoachingSessions(
    nearestQuery(userId, relationshipIds, utcInstant(week.start.plus({ weeks: 1 })))
  );

  const settled = [relationshipList, aroundStart, aroundEnd].every((r) => !r.isLoading && !r.isError);
  return settled ? weekEdges(aroundStart.sessions, aroundEnd.sessions, week) : UNKNOWN_EDGES;
}

function nearestQuery(userId: Id, relationshipIds: Id[], around: string): Option<NearestEachQuery> {
  return relationshipIds.length > 0
    ? Some({ userId, relationshipIds, around, fetchedFor: around })
    : None;
}
