"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/components/lib/utils";
import CoachingSessionForm, { CoachingSessionFormMode } from "./coaching-session-form";
import type { CoachingSession } from "@/types/coaching-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUser } from "@/lib/api/users";
import { FALLBACK_DURATION_MINUTES } from "@/types/coaching-session-duration";

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
  const { userId } = useAuthStore((state) => state);
  const { user } = useUser(userId);
  const defaultDurationMinutes =
    user?.default_coaching_session_duration_minutes ?? FALLBACK_DURATION_MINUTES;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90dvh] overflow-y-auto",
          mode === "create" ? "sm:max-w-3xl" : "sm:max-w-lg"
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New Coaching Session" : "Update Coaching Session"}
          </DialogTitle>
        </DialogHeader>
        <CoachingSessionForm
          mode={mode}
          existingSession={coachingSessionToEdit}
          onOpenChange={onOpenChange}
          defaultDurationMinutes={defaultDurationMinutes}
        />
      </DialogContent>
    </Dialog>
  );
}
