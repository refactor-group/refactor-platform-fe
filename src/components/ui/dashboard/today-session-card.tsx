"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Share, User, Target, Building } from "lucide-react";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { cn } from "@/components/lib/utils";
import { SessionUrgency } from "@/types/session-display";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { DateTime } from "ts-luxon";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
} from "@/lib/sessions/session-utils";

interface TodaySessionCardProps {
  session: EnrichedCoachingSession;
  sessionIndex?: number;
  totalSessions?: number;
  onReschedule?: () => void;
}

/**
 * Get the participant details for display
 * Story: "Show who the user is meeting with"
 */
function getParticipantInfo(session: EnrichedCoachingSession, userId: string) {
  const relationship = session.relationship;
  if (!relationship) return null;

  const isCoach = relationship.coach_id === userId;
  const userRole = isCoach ? "Coach" : "Coachee";
  const participant = isCoach ? relationship.coachee : relationship.coach;
  const participantName =
    participant.display_name ||
    `${participant.first_name} ${participant.last_name}`;

  return { participantName, userRole, isCoach };
}

/**
 * Format the session time for display
 * Story: "Show when the session is happening"
 */
function formatSessionTime(session: EnrichedCoachingSession, timezone: string) {
  const sessionTime = DateTime.fromISO(session.date, { zone: "utc" }).setZone(
    timezone
  );
  return sessionTime.toFormat("h:mm a ZZZZ");
}

/**
 * Get urgency information for the session
 * Story: "Categorize how soon the session is starting"
 */
function getSessionUrgencyInfo(session: EnrichedCoachingSession, timezone: string) {
  const urgency = calculateSessionUrgency(session);
  const urgencyMessage = getUrgencyMessage(session, urgency, timezone);
  const isPast = urgency === SessionUrgency.Past;

  return { urgency, urgencyMessage, isPast };
}

export function TodaySessionCard({
  session,
  sessionIndex,
  totalSessions,
  onReschedule,
}: TodaySessionCardProps) {
  const { isCurrentCoach, userSession } = useAuthStore((state) => state);

  if (!userSession) return null;

  const handleCopyLink = async () => {
    await copyCoachingSessionLinkWithToast(session.id);
  };

  // Compute display values from session data
  const participantInfo = getParticipantInfo(session, userSession.id);
  if (!participantInfo) return null;

  const timezone = userSession.timezone || getBrowserTimezone();
  const timeStr = formatSessionTime(session, timezone);
  const { urgency, urgencyMessage, isPast } = getSessionUrgencyInfo(
    session,
    timezone
  );

  const goalText = session.overarching_goal?.title || "No goal set";
  const organizationName = session.organization?.name || "Unknown organization";

  const getUrgencyStyles = (urgencyType: SessionUrgency) => {
    switch (urgencyType) {
      case SessionUrgency.Imminent:
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800";
      case SessionUrgency.Soon:
        return "bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800";
      case SessionUrgency.Later:
        return "bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800";
      case SessionUrgency.Past:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Card className="border-border !shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Status Indicator Section */}
      <div
        className={cn(
          "px-4 py-1 rounded-t-lg border-b flex items-center justify-between bg-sidebar",
          getUrgencyStyles(urgency)
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{urgencyMessage}</span>
          {sessionIndex !== undefined && totalSessions !== undefined && (
            <span className="text-xs opacity-70">
              ({sessionIndex} / {totalSessions} today)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-background/50">
            {timeStr}
          </Badge>
          <div className="h-4 w-px bg-current opacity-30" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-1"
            onClick={handleCopyLink}
          >
            <Share className="h-3.5 w-3.5" />
            <span className="sr-only">Copy session link</span>
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Session Title */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            Coaching Session
          </h3>
          <p
            className="text-sm text-muted-foreground truncate"
            title={goalText}
          >
            Goal: {goalText}
          </p>
        </div>

        {/* Session Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>
              Meeting with:{" "}
              <span className="font-medium">{participantInfo.participantName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>
              Your role: <span className="font-medium">{participantInfo.userRole}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span className="font-medium">{organizationName}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Action Buttons */}
        <div className="flex gap-2 items-center">
          <Link href={`/coaching-sessions/${session.id}`}>
            <Button size="default">
              {isPast ? "View Session" : "Join Session"}
            </Button>
          </Link>

          {participantInfo.isCoach && (
            <Button variant="outline" size="default" onClick={onReschedule}>
              Reschedule
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
