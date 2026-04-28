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
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";

export function DashboardContainer() {
  // Used to live inside the per-card relationship selector. Now that the
  // dashboard has no visible selector (the new CoachingSessionsCard is
  // user-scoped), wire the hook here so single-relationship users still get
  // auto-selection — UpcomingSessionCard and GoalsOverviewCard depend on a
  // selected `currentCoachingRelationshipId`.
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships, isLoading: isLoadingRelationships } =
    useCoachingRelationshipList(currentOrganizationId);
  const {
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId,
  } = useCurrentCoachingRelationship();
  useAutoSelectSingleRelationship(
    relationships,
    isLoadingRelationships,
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<
    CoachingSession | undefined
  >();
  const [refreshUpcomingSession, setRefreshUpcomingSession] = useState<(() => void) | null>(() => null);

  const handleOpenDialog = (session?: CoachingSession | EnrichedCoachingSession) => {
    setSessionToEdit(session);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSessionToEdit(undefined);
    // Force-refresh the upcoming session card after create/edit.
    refreshUpcomingSession?.();
  };

  // Stable reference so the card's onRefreshNeeded useEffect doesn't refire
  // on every parent render.
  const handleRefreshNeeded = useCallback(
    (refreshFn: () => void) => setRefreshUpcomingSession(() => refreshFn),
    [],
  );

  return (
    <>
      <DashboardHeader onCreateSession={() => handleOpenDialog()} />

      {/* Upcoming Session + Goals Overview (2-col grid on md+).
          Width follows the page's max-w-screen-2xl via PageContainer. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 mb-8 w-full">
        <UpcomingSessionCard
          onReschedule={handleOpenDialog}
          onCreateSession={() => handleOpenDialog()}
          onRefreshNeeded={handleRefreshNeeded}
        />
        <GoalsOverviewCard />
      </div>

      <div className="w-full">
        <CoachingSessionsCard
          onReschedule={handleOpenDialog}
          onSessionDeleted={() => refreshUpcomingSession?.()}
        />
      </div>
      <CoachingSessionDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        coachingSessionToEdit={sessionToEdit}
      />
    </>
  );
}
