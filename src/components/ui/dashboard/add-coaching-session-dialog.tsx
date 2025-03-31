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

interface AddCoachingSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCoachingSessionAdded: () => void;
  dialogTrigger: React.ReactElement<React.HTMLAttributes<HTMLButtonElement>>;
}

export function AddCoachingSessionDialog({
  open,
  onOpenChange,
  onCoachingSessionAdded,
  dialogTrigger,
}: AddCoachingSessionDialogProps) {
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
  const { create: createCoachingSession } = useCoachingSessionMutation();
  const [newSessionDate, setNewSessionDate] = useState<Date | undefined>(
    undefined
  );
  const [newSessionTime, setNewSessionTime] = useState<string>("");
  const { isCoach } = useAuthStore((state) => state);

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionDate || !newSessionTime) return;

    const [hours, minutes] = newSessionTime.split(":").map(Number);
    const dateTime = getDateTimeFromString(newSessionDate.toISOString())
      .set({ hour: hours, minute: minutes })
      .toFormat("yyyy-MM-dd'T'HH:mm:ss");

    const newCoachingSession: CoachingSession = {
      ...defaultCoachingSession(),
      coaching_relationship_id: currentCoachingRelationshipId,
      date: dateTime,
    };

    createCoachingSession(newCoachingSession)
      .then(() => {
        refresh();
        onCoachingSessionAdded();
        setNewSessionDate(undefined);
        setNewSessionTime("");
      })
      .catch((err: Error) => {
        console.error("Failed to create new Coaching Session: " + err);
        throw err;
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {React.cloneElement(dialogTrigger, {
          ...(dialogTrigger.props as React.HTMLAttributes<HTMLButtonElement>),
          className: cn(
            (dialogTrigger.props as React.HTMLAttributes<HTMLButtonElement>)
              .className
          ),
        })}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Coaching Session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="session-date">Session Date</Label>
            <Calendar
              mode="single"
              selected={newSessionDate}
              onSelect={(date) => setNewSessionDate(date)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="session-time">Session Time</Label>
            <input
              type="time"
              id="session-time"
              value={newSessionTime}
              onChange={(e) => setNewSessionTime(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </div>
          <Button type="submit">Create Session</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
