"use client";

import { useState } from "react";
import CoachingSessionList from "@/components/ui/dashboard/coaching-session-list";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
import { DashboardHeader } from "@/components/ui/dashboard/dashboard-header";
import { TodaysSessions } from "@/components/ui/dashboard/todays-sessions";
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";

export function DashboardContainer() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<
    CoachingSession | undefined
  >();
  const [refreshTodaysSessions, setRefreshTodaysSessions] = useState<(() => void) | null>(() => null);

  const handleOpenDialog = (session?: CoachingSession | EnrichedCoachingSession) => {
    setSessionToEdit(session);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSessionToEdit(undefined);
    // Refresh today's sessions after dialog closes (covers both create and edit)
    refreshTodaysSessions?.();
  };

  return (
    <>
      <DashboardHeader onCreateSession={() => handleOpenDialog()} />

      {/* Today's Sessions — constrained width on wide screens, full width on narrow */}
      <div className="mb-8 mt-8 w-full max-w-5xl min-w-[320px]">
        <TodaysSessions
          onRescheduleSession={handleOpenDialog}
          onRefreshNeeded={(refreshFn) => setRefreshTodaysSessions(() => refreshFn)}
        />
      </div>

      <div className="w-full max-w-5xl min-w-[320px]">
        <h2 className="text-lg font-semibold pb-6">Coaching Sessions</h2>
        <CoachingSessionList onUpdateSession={handleOpenDialog} onSessionDeleted={() => refreshTodaysSessions?.()} />
      </div>
      <CoachingSessionDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        coachingSessionToEdit={sessionToEdit}
      />
    </>
  );
}
