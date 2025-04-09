"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CoachingSessionForm, { CoachingSessionFormMode } from "./coaching-session-form";
import type { CoachingSession } from "@/types/coaching-session";

interface CoachingSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachingSessionToEdit?: CoachingSession;
}

export function CoachingSessionDialog({
  open,
  onOpenChange,
  coachingSessionToEdit,
}: CoachingSessionDialogProps) {
  const mode: CoachingSessionFormMode = coachingSessionToEdit ? "update" : "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Coaching Session" : "Update Coaching Session"}
          </DialogTitle>
        </DialogHeader>
        <CoachingSessionForm
          mode={mode}
          existingSession={coachingSessionToEdit}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
