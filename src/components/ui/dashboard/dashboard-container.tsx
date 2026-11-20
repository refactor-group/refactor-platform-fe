"use client";

import { useCallback, useState } from "react";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { NextSessionCard } from "@/components/ui/dashboard/next-session-card";
import { TodaysBriefingPanel } from "@/components/ui/dashboard/todays-briefing-panel";
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
  // are auto-selected here for NextSessionCard and GoalsOverviewCard.
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
  const [refreshNextSession, setRefreshNextSession] = useState<(() => void) | null>(() => null);

  const handleCreateSession = () => openSchedule(None);

  // Stable, so the card's onRefreshNeeded effect doesn't refire every render.
  const handleNextSessionRefreshNeeded = useCallback(
    (refreshFn: () => void) => setRefreshNextSession(() => refreshFn),
    [],
  );

  const handleSeriesMutated = useCallback(() => {
    refreshNextSession?.();
  }, [refreshNextSession]);

  return (
    <>
      <TodaysBriefingPanel>
        <NextSessionCard
          onCreateSession={handleCreateSession}
          onRefreshNeeded={handleNextSessionRefreshNeeded}
        />
        <GoalsOverviewCard />
      </TodaysBriefingPanel>

      <div className="mt-8 w-full">
        <WeekPanel
          onReschedule={openMoveSession}
          onSeriesMutated={handleSeriesMutated}
          onSchedule={openSchedule}
        />
      </div>
    </>
  );
}
