"use client";

import { useState } from "react";
import type * as React from "react";
import { cn } from "@/components/lib/utils";
import CoachingSessionList from "@/components/ui/dashboard/coaching-session-list";
import AddEntities from "@/components/ui/dashboard/add-entities";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
import type { CoachingSession } from "@/types/coaching-session";

export function DashboardContainer() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<
    CoachingSession | undefined
  >();

  const handleOpenDialog = (session?: CoachingSession) => {
    setSessionToEdit(session);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSessionToEdit(undefined);
  };

  return (
    <div
      className={cn(
        // Base styles
        "p-4",
        // Mobile: stack vertically
        "flex flex-col gap-6",
        // Never grow wider than the site-header
        "max-w-screen-2xl",
        // Ensure full width for children
        "[&>*]:w-full"
      )}
    >
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
    </div>
  );
}
