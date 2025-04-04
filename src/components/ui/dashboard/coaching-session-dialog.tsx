"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CoachingSessionFormMode } from "./coaching-session-form";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";

interface CoachingSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: CoachingSessionFormMode;
  children: React.ReactNode;
}

export function CoachingSessionDialog({
  open,
  onOpenChange,
  mode,
  children,
}: CoachingSessionDialogProps) {

  const { isCoach } = useAuthStore((state) => state);
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!isCoach || !currentCoachingRelationshipId}
        >
          Create New Coaching Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Create New Coaching Session"
              : "Update Coaching Session"}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
