import type { DateTime } from "ts-luxon";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useNearestEachCoachingSessions, type NearestEachQuery } from "@/lib/api/coaching-sessions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { peopleFor } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { utcInstant } from "@/lib/session-window";
import type { FilterPerson } from "@/lib/week-grid/filter";
import { lastSessionBefore } from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

/**
 * The viewer's latest session that has started, with `person` or with anyone.
 * Measured from the top of the hour so the fetch key holds for an hour.
 */
export function useLastSession(person: Option<FilterPerson>, now: DateTime): Option<EnrichedCoachingSession> {
  const userId = useAuthStore((s) => s.userId);
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships } = useCoachingRelationshipList(currentOrganizationId);
  const relationshipIds = person.some
    ? person.val.relationshipIds
    : peopleFor(userId, relationships).flatMap((p) => p.relationshipIds);
  const around = now.startOf("hour");

  const { sessions, isLoading, isError } = useNearestEachCoachingSessions(
    nearestQuery(userId, relationshipIds, utcInstant(around))
  );
  return isLoading || isError ? None : lastSessionBefore(sessions, around);
}

function nearestQuery(userId: Id, relationshipIds: Id[], around: string): Option<NearestEachQuery> {
  return relationshipIds.length > 0 ? Some({ userId, relationshipIds, around, fetchedFor: around }) : None;
}
