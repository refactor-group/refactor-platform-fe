"use client";

import { useState } from "react";
import type * as React from "react";
import CoachingSessionList from "@/components/ui/dashboard/coaching-session-list";
import AddEntities from "@/components/ui/dashboard/add-entities";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
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
    // Refresh today's sessions after closing dialog (if session was edited)
    if (sessionToEdit && refreshTodaysSessions) {
      refreshTodaysSessions();
    }
  };

  return (
    <>
      <TodaysSessions
        onRescheduleSession={handleOpenDialog}
        onRefreshNeeded={(refreshFn) => setRefreshTodaysSessions(() => refreshFn)}
      />
      <AddEntities
        className="mb-8"
        onCreateSession={() => handleOpenDialog()}
      />
      <CoachingSessionList onUpdateSession={handleOpenDialog} />
      <CoachingSessionDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        coachingSessionToEdit={sessionToEdit}
      />
    </>
  );
}
