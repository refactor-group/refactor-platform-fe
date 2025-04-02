"use client";

import React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { getDateTimeFromString } from "@/types/general";
import {
  CoachingSession,
  defaultCoachingSession,
} from "@/types/coaching-session";
import {
  useCoachingSessionList,
  useCoachingSessionMutation,
} from "@/lib/api/coaching-sessions";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { cn } from "@/components/lib/utils";
import { format } from "date-fns";

interface CoachingSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCoachingSessionUpdated: () => void;
  dialogTrigger?: React.ReactElement<React.HTMLAttributes<HTMLButtonElement>>;
  existingSession?: CoachingSession;
  mode: "create" | "update";
}

export function CoachingSessionDialog({
  open,
  onOpenChange,
  onCoachingSessionUpdated,
  dialogTrigger,
  existingSession,
  mode,
}: CoachingSessionDialogProps) {
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });
  const { refresh } = useCoachingSessionList(
    currentCoachingRelationshipId,
    fromDate,
    toDate
  );
  const { create: createCoachingSession, update } =
    useCoachingSessionMutation();
  const [sessionDate, setSessionDate] = useState<Date | undefined>(
    existingSession ? new Date(existingSession.date) : undefined
  );
  const [sessionTime, setSessionTime] = useState<string>(
    existingSession ? format(new Date(existingSession.date), "HH:mm") : ""
  );
  const { isCoach } = useAuthStore((state) => state);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionDate || !sessionTime) return;

    const [hours, minutes] = sessionTime.split(":").map(Number);
    const dateTime = getDateTimeFromString(sessionDate.toISOString())
      .set({ hour: hours, minute: minutes })
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    try {
      if (mode === "create") {
        const newCoachingSession: CoachingSession = {
          ...defaultCoachingSession(),
          coaching_relationship_id: currentCoachingRelationshipId,
          date: dateTime,
        };
        await createCoachingSession(newCoachingSession);
      } else if (existingSession) {
        await update(existingSession.id, {
          ...existingSession,
          date: dateTime,
          updated_at: DateTime.now(),
        });
      }
      refresh();
      onCoachingSessionUpdated();
      setSessionDate(undefined);
      setSessionTime("");
      onOpenChange(false);
    } catch (error) {
      console.error(`Failed to ${mode} coaching session:`, error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {dialogTrigger && (
        <DialogTrigger asChild>
          {React.cloneElement(dialogTrigger, {
            ...(dialogTrigger.props as React.HTMLAttributes<HTMLButtonElement>),
            className: cn(
              (dialogTrigger.props as React.HTMLAttributes<HTMLButtonElement>)
                .className
            ),
          })}
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Create New Coaching Session"
              : "Update Coaching Session"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-date">Session Date</Label>
            <Calendar
              mode="single"
              selected={sessionDate}
              onSelect={(date) => setSessionDate(date)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-time">Session Time</Label>
            <input
              type="time"
              id="session-time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>
          <Button type="submit" disabled={!sessionDate || !sessionTime}>
            {mode === "create" ? "Create Session" : "Update Session"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
