"use client";

import { useCallback, useState } from "react";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
import { CoachingSessionsCard } from "@/components/ui/dashboard/coaching-sessions-card";
import { DashboardHeader } from "@/components/ui/dashboard/dashboard-header";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { UpcomingSessionCard } from "@/components/ui/dashboard/upcoming-session-card";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useAutoSelectSingleRelationship } from "@/lib/hooks/use-auto-select-single-relationship";
import { useForgetRelationshipOutsideOrganization } from "@/lib/hooks/use-forget-relationship-outside-organization";
import { useNewSessionDialogStore } from "@/lib/providers/new-session-dialog-store-provider";
import type { CoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";

export function DashboardContainer({ locale }: { locale: string }) {
  // Used to live inside the per-card relationship selector. Now that the
  // dashboard has no visible selector (the new CoachingSessionsCard is
  // user-scoped), wire the hook here so single-relationship users still get
  // auto-selection — UpcomingSessionCard and GoalsOverviewCard depend on a
  // selected `currentCoachingRelationshipId`.
  const { currentOrganizationId } = useCurrentOrganization();
  const {
    relationships,
    isLoading: isLoadingRelationships,
    isError: relationshipsError,
  } = useCoachingRelationshipList(currentOrganizationId);
  const {
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId,
    resetCoachingRelationshipState,
  } = useCurrentCoachingRelationship();
  useForgetRelationshipOutsideOrganization({
    relationships,
    isLoading: isLoadingRelationships,
    isError: !!relationshipsError,
    currentId: currentCoachingRelationshipId ? Some(currentCoachingRelationshipId) : None,
    forget: resetCoachingRelationshipState,
  });
  useAutoSelectSingleRelationship(
    relationships,
    isLoadingRelationships,
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId
  );

  const openSchedule = useNewSessionDialogStore((state) => state.openSchedule);
  const [sessionToEdit, setSessionToEdit] = useState<Option<CoachingSession>>(None);
  const [refreshUpcomingSession, setRefreshUpcomingSession] = useState<(() => void) | null>(() => null);
  const [refreshSessionsCard, setRefreshSessionsCard] = useState<(() => void) | null>(() => null);

  const handleReschedule = (session: CoachingSession) => setSessionToEdit(Some(session));
  const handleCreateSession = () => openSchedule(None);

  const handleCloseDialog = () => {
    setSessionToEdit(None);
    // Force-refresh BOTH affected surfaces after an edit. The
    // user-scoped fetches behind these cards use a tuple SWR key
    // (`[url, params]`) which `useEntityMutation`'s auto-invalidation
    // skips (it filters by `typeof key === "string"`), so without these
    // explicit calls an edited session wouldn't update in either
    // card until a hard reload.
    refreshUpcomingSession?.();
    refreshSessionsCard?.();
  };

  // Stable references so the cards' onRefreshNeeded useEffects don't
  // refire on every parent render.
  const handleUpcomingSessionRefreshNeeded = useCallback(
    (refreshFn: () => void) => setRefreshUpcomingSession(() => refreshFn),
    [],
  );
  const handleSessionsCardRefreshNeeded = useCallback(
    (refreshFn: () => void) => setRefreshSessionsCard(() => refreshFn),
    [],
  );

  const handleSeriesMutated = useCallback(() => {
    refreshUpcomingSession?.();
    refreshSessionsCard?.();
  }, [refreshUpcomingSession, refreshSessionsCard]);

  return (
    <>
      <DashboardHeader onCreateSession={handleCreateSession} />

      {/* Upcoming Session + Goals Overview (2-col grid on md+).
          Width follows the page's max-w-screen-2xl via PageContainer. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 mb-8 w-full">
        <UpcomingSessionCard
          onReschedule={handleReschedule}
          onCreateSession={handleCreateSession}
          onRefreshNeeded={handleUpcomingSessionRefreshNeeded}
        />
        <GoalsOverviewCard />
      </div>

      <div className="w-full">
        <CoachingSessionsCard
          onReschedule={handleReschedule}
          onRefreshNeeded={handleSessionsCardRefreshNeeded}
          onSeriesMutated={handleSeriesMutated}
          locale={locale}
        />
      </div>
      {sessionToEdit.some && (
        <CoachingSessionDialog
          open
          onOpenChange={handleCloseDialog}
          coachingSession={sessionToEdit.val}
        />
      )}
    </>
  );
}
