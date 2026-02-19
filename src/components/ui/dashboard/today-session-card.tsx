"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userSessionFirstLastLettersToString } from "@/types/user-session";
import Link from "next/link";
import { Share, Target, Building, CheckSquare } from "lucide-react";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { cn } from "@/components/lib/utils";
import { PulsingDot } from "@/components/ui/pulsing-dot";
import { SessionUrgency } from "@/types/session-display";
import { RelationshipRole } from "@/types/relationship-role";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { DateTime } from "ts-luxon";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
  formatSessionTime,
} from "@/lib/utils/session";

/**
 * Props for the TodaySessionCard component
 */
interface TodaySessionCardProps {
  /** The enriched coaching session data to display */
  session: EnrichedCoachingSession;
  /** Optional index of this session in the list (1-based) */
  sessionIndex?: number;
  /** Optional total number of sessions today */
  totalSessions?: number;
  /** Assigned actions to filter for this session */
  assignedActions?: AssignedActionWithContext[];
  /** Optional callback function to handle rescheduling the session */
  onReschedule?: () => void;
}

/**
 * Information about the other participant in the coaching session
 */
type ParticipantInfo = {
  /** The display name of the participant (coach or coachee) */
  readonly participantName: string;
  /** The participant's first name (for avatar initials) */
  readonly firstName: string;
  /** The participant's last name (for avatar initials) */
  readonly lastName: string;
  /** The current user's role in the session (Coach or Coachee) */
  readonly userRole: RelationshipRole;
  /** Whether the current user is the coach in this session */
  readonly isCoach: boolean;
} | null;

/**
 * Get the participant details for display
 *
 * Determines the other participant in the session (coach or coachee) based on
 * the current user's ID, and extracts their display information.
 *
 * Story: "Show who the user is meeting with"
 *
 * @param session - The enriched coaching session containing relationship and participant data
 * @param userId - The current user's ID to determine their role
 * @returns Participant information including name, role, and coach status, or null if data is missing
 */
function getParticipantInfo(session: EnrichedCoachingSession, userId: string): ParticipantInfo {
  const relationship = session.relationship;
  if (!relationship) return null;

  const isCoach = relationship.coach_id === userId;
  const userRole = isCoach ? RelationshipRole.Coach : RelationshipRole.Coachee;

  // Backend returns coach and coachee as top-level fields in EnrichedSession
  const participant = isCoach ? session.coachee : session.coach;

  // Handle missing participant data
  if (!participant) {
    console.warn(
      `Session ${session.id}: Missing ${isCoach ? 'coachee' : 'coach'} user data.`,
      'Session data:', session
    );
    return {
      participantName: isCoach ? "Coachee (data not loaded)" : "Coach (data not loaded)",
      firstName: "",
      lastName: "",
      userRole,
      isCoach,
    };
  }

  const participantName =
    `${participant.first_name} ${participant.last_name}` ||
    participant.display_name;

  return {
    participantName,
    firstName: participant.first_name,
    lastName: participant.last_name,
    userRole,
    isCoach,
  };
}


/**
 * Information about the urgency status of a session
 */
type SessionUrgencyInfo = {
  /** The urgency level of the session (Imminent, Soon, Later, or Past) */
  readonly urgency: SessionUrgency;
  /** Human-readable message describing the urgency (e.g., "Starting in 15 minutes") */
  readonly urgencyMessage: string;
  /** Whether the session is in the past */
  readonly isPast: boolean;
};

/**
 * Get urgency information for the session
 *
 * Calculates how soon the session is starting and generates appropriate
 * urgency messaging and styling information.
 *
 * Story: "Categorize how soon the session is starting"
 *
 * @param session - The coaching session to analyze
 * @param timezone - The user's timezone for time calculations
 * @returns Urgency information including level, message, and past status
 */
function getSessionUrgencyInfo(session: EnrichedCoachingSession, timezone: string): SessionUrgencyInfo {
  const urgency = calculateSessionUrgency(session);
  const urgencyMessage = getUrgencyMessage(session, urgency, timezone);
  const isPast = urgency === SessionUrgency.Past;

  return { urgency, urgencyMessage, isPast };
}

/**
 * TodaySessionCard Component
 *
 * Displays a coaching session card for sessions happening today. Shows session details
 * including participant information, timing, urgency status, and provides action buttons
 * for joining the session or rescheduling (coaches only).
 *
 * Features:
 * - Color-coded urgency indicator based on how soon the session starts
 * - Session time display in user's timezone
 * - Participant information (who the user is meeting with)
 * - Session goal and organization details
 * - Share link functionality
 * - Join/View session button
 * - Reschedule option (coaches only)
 *
 * @param props - Component props
 * @returns The rendered session card, or null if no user session or participant info
 *
 * @example
 * ```tsx
 * <TodaySessionCard
 *   session={enrichedSession}
 *   sessionIndex={1}
 *   totalSessions={3}
 *   onReschedule={() => handleReschedule(session.id)}
 * />
 * ```
 */
export function TodaySessionCard({
  session,
  sessionIndex,
  totalSessions,
  assignedActions = [],
  onReschedule,
}: TodaySessionCardProps) {
  const { userSession } = useAuthStore((state) => state);

  if (!userSession) return null;

  // Count actions due by this session for this relationship
  const sessionDate = DateTime.fromISO(session.date);
  const actionsDueCount = assignedActions.filter((a) => {
    // Must be for this coaching relationship
    if (a.relationship.coachingRelationshipId !== session.coaching_relationship_id) {
      return false;
    }
    // Must be due on or before this session
    return a.action.due_by <= sessionDate;
  }).length;

  /**
   * Handles copying the session link to clipboard with a toast notification
   */
  const handleCopyLink = async () => {
    await copyCoachingSessionLinkWithToast(session.id);
  };

  // Compute display values from session data
  const participantInfo = getParticipantInfo(session, userSession.id);
  if (!participantInfo) return null;

  const timezone = userSession.timezone || getBrowserTimezone();
  const timeStr = formatSessionTime(session.date, timezone);
  const { urgency, urgencyMessage, isPast } = getSessionUrgencyInfo(
    session,
    timezone
  );

  const goalText = session.overarching_goal?.title || "No goal set";
  const organizationName = session.organization?.name || "Unknown organization";

  /**
   * Returns Tailwind CSS classes for styling based on session urgency
   *
   * @param urgencyType - The urgency level of the session
   * @returns CSS class string for background, text, and border colors
   */
  const getUrgencyStyles = (urgencyType: SessionUrgency) => {
    switch (urgencyType) {
      case SessionUrgency.Underway:
        return "bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800";
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
          {(urgency === SessionUrgency.Underway || urgency === SessionUrgency.Imminent) && (
            <PulsingDot />
          )}
          <span className="text-sm font-medium">{urgencyMessage}</span>
          {sessionIndex !== undefined && totalSessions !== undefined && (
            <span className="text-xs opacity-70">
              ({sessionIndex} / {totalSessions} sessions)
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
        {/* Session Title with Avatar */}
        <div className="flex gap-4">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage
              src={undefined}
              alt={participantInfo.participantName}
            />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {userSessionFirstLastLettersToString(
                participantInfo.firstName,
                participantInfo.lastName
              )}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Coaching Session with {participantInfo.participantName}
            </h3>
            <p
              className="text-sm text-muted-foreground truncate"
              title={goalText}
            >
              Goal: {goalText}
            </p>
          </div>
        </div>

        {/* Session Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckSquare className="h-4 w-4" />
            <span>
              You have{" "}
              <span className="font-medium">
                {actionsDueCount} {actionsDueCount === 1 ? "action" : "actions"}
              </span>{" "}
              due
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
