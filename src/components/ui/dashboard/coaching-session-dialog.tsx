"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CoachingSessionForm from "./coaching-session-form";
import type { CoachingSession } from "@/types/coaching-session";

interface CoachingSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coachingSession: CoachingSession;
}

export function CoachingSessionDialog({
  open,
  onOpenChange,
  coachingSession,
}: CoachingSessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Coaching Session</DialogTitle>
        </DialogHeader>
        <CoachingSessionForm existingSession={coachingSession} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}
