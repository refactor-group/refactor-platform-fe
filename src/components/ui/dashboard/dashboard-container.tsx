"use client";

import { useCallback, useState } from "react";
import { DashboardHeader } from "@/components/ui/dashboard/dashboard-header";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { UpcomingSessionCard } from "@/components/ui/dashboard/upcoming-session-card";
import { WeekPanel } from "@/components/ui/dashboard/week-grid/week-panel";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useAutoSelectSingleRelationship } from "@/lib/hooks/use-auto-select-single-relationship";
import { useForgetRelationshipOutsideOrganization } from "@/lib/hooks/use-forget-relationship-outside-organization";
import { useNewSessionDialogStore } from "@/lib/providers/new-session-dialog-store-provider";
import { None, Some } from "@/types/option";

export function DashboardContainer() {
  // The dashboard has no relationship selector, so single-relationship users
  // are auto-selected here for UpcomingSessionCard and GoalsOverviewCard.
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
  const openMoveSession = useNewSessionDialogStore((state) => state.openMoveSession);
  const [refreshUpcomingSession, setRefreshUpcomingSession] = useState<(() => void) | null>(() => null);

  const handleCreateSession = () => openSchedule(None);

  // Stable, so the card's onRefreshNeeded effect doesn't refire every render.
  const handleUpcomingSessionRefreshNeeded = useCallback(
    (refreshFn: () => void) => setRefreshUpcomingSession(() => refreshFn),
    [],
  );

  const handleSeriesMutated = useCallback(() => {
    refreshUpcomingSession?.();
  }, [refreshUpcomingSession]);

  return (
    <>
      <DashboardHeader onCreateSession={handleCreateSession} />

      {/* Upcoming Session + Goals Overview (2-col grid on md+).
          Width follows the page's max-w-screen-2xl via PageContainer. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 mb-8 w-full">
        <UpcomingSessionCard
          onReschedule={openMoveSession}
          onCreateSession={handleCreateSession}
          onRefreshNeeded={handleUpcomingSessionRefreshNeeded}
        />
        <GoalsOverviewCard />
      </div>

      <div className="w-full">
        <WeekPanel onReschedule={openMoveSession} onSeriesMutated={handleSeriesMutated} />
      </div>
    </>
  );
}
