import { useMemo } from "react";
import { getOneYearAgo, getOneYearFromNow } from "@/lib/utils/date";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList } from "@/lib/api/user-actions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoacheeActionsFetch } from "@/lib/hooks/use-coachee-actions-fetch";
import {
  CoachViewMode,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Id } from "@/types/general";
import {
  buildSessionLookupMaps,
  addContextToActions,
} from "@/lib/utils/assigned-actions";
import { getRelationshipsAsCoach } from "@/types/coaching-relationship";

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Fetches and enriches all actions for the current user (or their coachees).
 *
 * Unlike useAssignedActions, this hook skips filterActionsByStatus and
 * groupActionsByRelationship — the kanban board groups by status column
 * and applies its own client-side filters.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 * @param relationshipId - Optional filter to a specific coaching relationship (server-side)
 */
export function useAllActionsWithContext(
  viewMode: CoachViewMode,
  relationshipId?: Id
) {
  // ---------------------------------------------------------------------------
  // Step 1: Get current user + org context
  // ---------------------------------------------------------------------------

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;
  const { currentOrganizationId } = useCurrentOrganization();

  const isCoacheeMode = viewMode === CoachViewMode.CoacheeActions;

  // ---------------------------------------------------------------------------
  // Step 2a: Fetch current user's actions (My Actions mode)
  // ---------------------------------------------------------------------------

  const {
    actions: myRawActions,
    isLoading: myActionsLoading,
    isError: myActionsError,
    refresh: refreshMyActions,
  } = useUserActionsList(
    !isCoacheeMode ? userId : null,
    {
      scope: UserActionsScope.Assigned,
      coaching_relationship_id: relationshipId,
    }
  );

  // ---------------------------------------------------------------------------
  // Step 2b: Fetch coachee actions (Coachee Actions mode)
  // ---------------------------------------------------------------------------

  const { relationships, isLoading: relsLoading } =
    useCoachingRelationshipList(
      isCoacheeMode ? currentOrganizationId : null
    );

  const coacheeIds = useMemo(() => {
    if (!isCoacheeMode || !userId || !relationships) return [];
    return getRelationshipsAsCoach(userId, relationships).map(
      (r) => r.coachee_id
    );
  }, [isCoacheeMode, userId, relationships]);

  const {
    actions: coacheeRawActions,
    isLoading: coacheeActionsLoading,
    isError: coacheeActionsError,
    refresh: refreshCoacheeActions,
  } = useCoacheeActionsFetch(coacheeIds, isCoacheeMode, relationshipId);

  // ---------------------------------------------------------------------------
  // Step 3: Fetch enriched sessions for context
  // ---------------------------------------------------------------------------

  const oneYearAgo = useMemo(() => getOneYearAgo(), []);
  const oneYearFromNow = useMemo(() => getOneYearFromNow(), []);

  const {
    enrichedSessions: sessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useEnrichedCoachingSessionsForUser(userId, oneYearAgo, oneYearFromNow, [
    CoachingSessionInclude.Relationship,
    CoachingSessionInclude.Goal,
  ]);

  // ---------------------------------------------------------------------------
  // Step 4: Build maps + enrich (skip filtering — kanban shows all statuses)
  // ---------------------------------------------------------------------------

  const rawActions = useMemo(
    () => (isCoacheeMode ? coacheeRawActions : (myRawActions ?? [])),
    [isCoacheeMode, coacheeRawActions, myRawActions]
  );

  const lookupMaps = useMemo(
    () => buildSessionLookupMaps(sessions ?? []),
    [sessions]
  );

  const actionsWithContext: AssignedActionWithContext[] = useMemo(
    () =>
      addContextToActions(
        rawActions,
        lookupMaps.sessionMap,
        lookupMaps.nextSessionByRelationship
      ),
    [rawActions, lookupMaps]
  );

  // ---------------------------------------------------------------------------
  // Step 5: Aggregate loading/error states and return
  // ---------------------------------------------------------------------------

  const isLoading =
    !userId ||
    sessionsLoading ||
    (isCoacheeMode
      ? relsLoading || coacheeActionsLoading
      : myActionsLoading);

  const isError =
    sessionsError ||
    (isCoacheeMode ? coacheeActionsError : myActionsError);

  const refresh = isCoacheeMode ? refreshCoacheeActions : refreshMyActions;

  return {
    actionsWithContext,
    isLoading,
    isError,
    refresh,
  };
}
