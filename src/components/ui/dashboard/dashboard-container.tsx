"use client";

import { useCallback, useState } from "react";
import CoachingSessionList from "@/components/ui/dashboard/coaching-session-list";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
import { DashboardHeader } from "@/components/ui/dashboard/dashboard-header";
import { GoalsOverviewCard } from "@/components/ui/dashboard/goals-overview-card";
import { UpcomingSessionCard } from "@/components/ui/dashboard/upcoming-session-card";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { getOtherPersonName } from "@/types/coaching-relationship";
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";

export function DashboardContainer() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<
    CoachingSession | undefined
  >();
  const [refreshUpcomingSession, setRefreshUpcomingSession] = useState<(() => void) | null>(() => null);

  const { userId } = useAuthStore((state) => ({ userId: state.userId }));
  const { currentOrganizationId } = useCurrentOrganization();
  const { currentCoachingRelationshipId, currentCoachingRelationship } =
    useCurrentCoachingRelationship();

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

  const canShowGoalsOverview =
    currentOrganizationId && currentCoachingRelationshipId && currentCoachingRelationship;

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
        {canShowGoalsOverview ? (
          <GoalsOverviewCard
            organizationId={currentOrganizationId}
            relationshipId={currentCoachingRelationshipId}
            coacheeName={getOtherPersonName(currentCoachingRelationship, userId)}
          />
        ) : (
          <div aria-hidden="true" />
        )}
      </div>

      <div className="w-full">
        <h2 className="text-lg font-semibold pb-6">Coaching Sessions</h2>
        <CoachingSessionList onUpdateSession={handleOpenDialog} onSessionDeleted={() => refreshUpcomingSession?.()} />
      </div>
      <CoachingSessionDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        coachingSessionToEdit={sessionToEdit}
      />
    </>
  );
}
