"use client";

import React from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpcomingSessionCardEmptyProps {
  /** Opens the coaching-session creation dialog. */
  onCreateSession: () => void;
  /** When false, the card hides the schedule CTA and shows coachee-appropriate
   *  subcopy instead. Scheduling sessions is a coach-only action (matches
   *  AddNewButton). */
  canCreateSession: boolean;
}

/**
 * Empty-state body for UpcomingSessionCard. Shown when no non-past session
 * remains today. Renders a centered calendar icon, a short headline and
 * subcopy, and — for coaches only — a primary button that opens the session
 * creation dialog. Coachees see copy that directs them to their coach.
 */
export function UpcomingSessionCardEmpty({
  onCreateSession,
  canCreateSession,
}: UpcomingSessionCardEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-4">
      <CalendarPlus
        className="h-8 w-8 text-muted-foreground/40"
        aria-hidden="true"
      />
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          No sessions scheduled for today
        </p>
        <p className="text-xs text-muted-foreground">
          {canCreateSession
            ? "Your day is clear. Schedule a session to get started."
            : "Your day is clear. Your coach will schedule your next session."}
        </p>
      </div>
      {canCreateSession && (
        <Button size="sm" className="mt-1" onClick={onCreateSession}>
          Schedule a coaching session
        </Button>
      )}
    </div>
  );
}
