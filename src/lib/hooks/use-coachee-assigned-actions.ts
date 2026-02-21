import { useMemo } from "react";
import { getOneYearAgo, getOneYearFromNow } from "@/lib/utils/date";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { getRelationshipsAsCoach } from "@/types/coaching-relationship";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCoacheeActionsFetch } from "@/lib/hooks/use-coachee-actions-fetch";
import { AssignedActionsFilter } from "@/types/assigned-actions";
import {
  buildSessionLookupMaps,
  processActions,
} from "@/lib/utils/assigned-actions";

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Fetches and processes actions assigned to coachees of the current user (coach).
 *
 * Pipeline: fetch coachee actions → fetch sessions → filter → enrich → group
 *
 * @param filter - Filter type (DueSoon, AllIncomplete, Completed)
 * @param enabled - Set to false to skip all fetching
 */
export function useCoacheeAssignedActions(
  filter: AssignedActionsFilter = AssignedActionsFilter.DueSoon,
  enabled: boolean = true
) {
  // -------------------------------------------------------------------------
  // Step 1: Get current user and their coachees
  // -------------------------------------------------------------------------

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;

  const { currentOrganizationId } = useCurrentOrganization();

  const { relationships, isLoading: relationshipsLoading } =
    useCoachingRelationshipList(enabled ? currentOrganizationId : null);

  const coacheeIds = useMemo(() => {
    if (!enabled || !userId || !relationships) return [];
    return getRelationshipsAsCoach(userId, relationships).map((r) => r.coachee_id);
  }, [enabled, userId, relationships]);

  // -------------------------------------------------------------------------
  // Step 2: Fetch data (actions for coachees + sessions for context)
  // -------------------------------------------------------------------------

  const {
    actions: rawActions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh,
  } = useCoacheeActionsFetch(coacheeIds, enabled);

  const oneYearAgo = useMemo(() => getOneYearAgo(), []);
  const oneYearFromNow = useMemo(() => getOneYearFromNow(), []);

  const {
    enrichedSessions: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useEnrichedCoachingSessionsForUser(
    enabled ? userId : null,
    oneYearAgo,
    oneYearFromNow,
    [CoachingSessionInclude.Relationship, CoachingSessionInclude.Goal]
  );

  // -------------------------------------------------------------------------
  // Step 3: Process actions (filter → enrich → group)
  // -------------------------------------------------------------------------

  const lookupMaps = useMemo(
    () => buildSessionLookupMaps(sessions ?? []),
    [sessions]
  );

  const processed = useMemo(
    () => processActions(rawActions, filter, null, lookupMaps),
    [rawActions, filter, lookupMaps]
  );

  // -------------------------------------------------------------------------
  // Step 4: Aggregate loading/error states and return
  // -------------------------------------------------------------------------

  const isLoading =
    enabled && (relationshipsLoading || actionsLoading || sessionsLoading);
  const isError = enabled && (actionsError || sessionsError);

  return {
    ...processed,
    isLoading,
    isError,
    refresh,
  };
}
