"use client";

import { useState } from "react";
import CoachingSessionList from "@/components/ui/dashboard/coaching-session-list";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
import { DashboardHeader } from "@/components/ui/dashboard/dashboard-header";
import { TodaysSessions } from "@/components/ui/dashboard/todays-sessions";
import { WhatsDue } from "@/components/ui/dashboard/whats-due/whats-due";
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
      <DashboardHeader onCreateSession={() => handleOpenDialog()} />

      {/* Today's Sessions and What's Due stacked vertically */}
      <div className="flex flex-col gap-6 mb-8 mt-4">
        <TodaysSessions
          onRescheduleSession={handleOpenDialog}
          onRefreshNeeded={(refreshFn) => setRefreshTodaysSessions(() => refreshFn)}
        />
        <WhatsDue />
      </div>

      <CoachingSessionList onUpdateSession={handleOpenDialog} />
      <CoachingSessionDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        coachingSessionToEdit={sessionToEdit}
      />
    </>
  );
}
