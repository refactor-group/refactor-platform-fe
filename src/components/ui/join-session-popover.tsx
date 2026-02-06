"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "ts-luxon";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/lib/utils";

import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";

import { calculateSessionUrgency } from "@/lib/utils/session";
import { getUrgencyMessage } from "@/lib/utils/session";
import {
  formatDateInUserTimezone,
  getBrowserTimezone,
} from "@/lib/timezone-utils";
import { getDateTimeFromString } from "@/types/general";

import {
  getRelationshipsAsCoach,
  getRelationshipsAsCoachee,
} from "@/types/coaching-relationship";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { SessionUrgency } from "@/types/session-display";
import type { Id } from "@/types/general";

// ---------------------------------------------------------------------------
// Helpers (replicated from today-session-card.tsx — file-local functions)
// ---------------------------------------------------------------------------

function formatSessionTime(
  session: EnrichedCoachingSession,
  timezone: string
): string {
  const sessionTime = DateTime.fromISO(session.date, { zone: "utc" }).setZone(
    timezone
  );
  return sessionTime.toFormat("h:mm a ZZZZ");
}

function getParticipantName(
  session: EnrichedCoachingSession,
  userId: string
): string {
  const relationship = session.relationship;
  if (!relationship) return "Unknown";

  const isCoach = relationship.coach_id === userId;
  const participant = isCoach ? session.coachee : session.coach;

  if (!participant) return isCoach ? "Coachee" : "Coach";

  return `${participant.first_name} ${participant.last_name}`.trim() ||
    participant.display_name;
}

/**
 * Returns the display name for the "other" person in a relationship,
 * relative to the current user.
 */
function getOtherPersonName(
  rel: CoachingRelationshipWithUserNames,
  userId: string
): string {
  if (rel.coach_id === userId) {
    return `${rel.coachee_first_name} ${rel.coachee_last_name}`.trim();
  }
  return `${rel.coach_first_name} ${rel.coach_last_name}`.trim();
}

// ---------------------------------------------------------------------------
// Section 1: Today's Sessions
// ---------------------------------------------------------------------------

function TodaysSessionsList({
  onSessionClick,
}: {
  onSessionClick: (sessionId: string) => void;
}) {
  const { sessions, isLoading, error } = useTodaysSessions([
    CoachingSessionInclude.Relationship,
    CoachingSessionInclude.Goal,
  ]);

  const { userId, userSession } = useAuthStore((state) => ({
    userId: state.userId,
    userSession: state.userSession,
  }));
  const timezone = userSession?.timezone || getBrowserTimezone();

  if (isLoading) {
    return <p className="px-2 py-3 text-sm text-muted-foreground">Loading...</p>;
  }

  if (error) {
    return (
      <p className="px-2 py-3 text-sm text-destructive">
        Error loading sessions
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="px-2 py-3 text-sm text-muted-foreground">
        No sessions scheduled for today
      </p>
    );
  }

  // Find index of the first non-past session for highlight
  const highlightIndex = sessions.findIndex(
    (session) => calculateSessionUrgency(session) !== SessionUrgency.Past
  );

  return (
    <div className="flex flex-col gap-1">
      {sessions.map((session, index) => {
        const urgency = calculateSessionUrgency(session);
        const urgencyMsg = getUrgencyMessage(session, urgency, timezone);
        const isHighlighted = index === highlightIndex;

        return (
          <button
            key={session.id}
            onClick={() => onSessionClick(session.id)}
            className={cn(
              "flex flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isHighlighted && "bg-accent/60 ring-1 ring-accent-foreground/20"
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="font-medium truncate">
                {getParticipantName(session, userId)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSessionTime(session, timezone)}
              </span>
            </div>
            <span
              className={cn(
                "text-xs",
                urgency === SessionUrgency.Imminent
                  ? "text-orange-600 dark:text-orange-400 font-medium"
                  : "text-muted-foreground"
              )}
            >
              {urgencyMsg}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Browse Sessions by Relationship
// ---------------------------------------------------------------------------

function RelationshipSessionBrowser({
  onSessionClick,
}: {
  onSessionClick: (sessionId: string) => void;
}) {
  const { userId, userSession } = useAuthStore((state) => ({
    userId: state.userId,
    userSession: state.userSession,
  }));
  const timezone = userSession?.timezone || getBrowserTimezone();

  const { currentOrganizationId } = useCurrentOrganization();
  const {
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId,
  } = useCurrentCoachingRelationship();

  // Fetch all relationships for the current org
  const { relationships, isLoading: isLoadingRels } =
    useCoachingRelationshipList(currentOrganizationId ?? "");

  // Filter to relationships where current user is a participant
  const userRelationships = userId
    ? [
        ...getRelationshipsAsCoach(userId, relationships),
        ...getRelationshipsAsCoachee(userId, relationships),
      ]
    : [];

  // Deduplicate (a user could theoretically appear in both arrays if data is odd)
  const uniqueRelationships = Array.from(
    new Map(userRelationships.map((r) => [r.id, r])).values()
  );

  // Sort by the other person's first name
  const sortedRelationships = [...uniqueRelationships].sort((a, b) => {
    const nameA = getOtherPersonName(a, userId);
    const nameB = getOtherPersonName(b, userId);
    return nameA.localeCompare(nameB);
  });

  const selectedRelationshipId = currentCoachingRelationshipId ?? undefined;

  const handleRelationshipChange = (relationshipId: Id) => {
    setCurrentCoachingRelationshipId(relationshipId);
  };

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={selectedRelationshipId}
        onValueChange={handleRelationshipChange}
        disabled={isLoadingRels || sortedRelationships.length === 0}
      >
        <SelectTrigger className="w-full text-sm">
          <SelectValue placeholder="Select a coachee..." />
        </SelectTrigger>
        <SelectContent>
          {sortedRelationships.map((rel) => (
            <SelectItem key={rel.id} value={rel.id}>
              {getOtherPersonName(rel, userId)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedRelationshipId && (
        <RelationshipSessionList
          userId={userId}
          relationshipId={selectedRelationshipId}
          timezone={timezone}
          onSessionClick={onSessionClick}
        />
      )}
    </div>
  );
}

function RelationshipSessionList({
  userId,
  relationshipId,
  timezone,
  onSessionClick,
}: {
  userId: string;
  relationshipId: string;
  timezone: string;
  onSessionClick: (sessionId: string) => void;
}) {
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });

  const { enrichedSessions, isLoading, isError } =
    useEnrichedCoachingSessionsForUser(
      userId,
      fromDate,
      toDate,
      [CoachingSessionInclude.Goal],
      "date",
      "desc",
      relationshipId
    );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading sessions...</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive">Error loading sessions</p>;
  }

  if (!enrichedSessions || enrichedSessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No sessions found</p>
    );
  }

  const now = DateTime.now();
  const upcoming = enrichedSessions.filter(
    (s) => getDateTimeFromString(s.date) >= now
  );
  const previous = enrichedSessions.filter(
    (s) => getDateTimeFromString(s.date) < now
  );

  return (
    <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
      {upcoming.length > 0 && (
        <SessionGroup
          label="Upcoming Sessions"
          sessions={upcoming}
          timezone={timezone}
          onSessionClick={onSessionClick}
        />
      )}
      {upcoming.length > 0 && previous.length > 0 && (
        <Separator className="my-1" />
      )}
      {previous.length > 0 && (
        <SessionGroup
          label="Previous Sessions"
          sessions={previous}
          timezone={timezone}
          onSessionClick={onSessionClick}
          dimmed
        />
      )}
    </div>
  );
}

function SessionGroup({
  label,
  sessions,
  timezone,
  onSessionClick,
  dimmed = false,
}: {
  label: string;
  sessions: EnrichedCoachingSession[];
  timezone: string;
  onSessionClick: (sessionId: string) => void;
  dimmed?: boolean;
}) {
  return (
    <div className={cn(dimmed && "opacity-60")}>
      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => onSessionClick(session.id)}
          className="flex flex-col items-start w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="truncate font-medium">
            {session.overarching_goal?.title || "No goal set"}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {formatDateInUserTimezone(session.date, timezone)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function JoinSessionPopover() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSessionClick = (sessionId: string) => {
    setOpen(false);
    router.push(`/coaching-sessions/${sessionId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <span className="hidden md:inline">Join Session</span>
          <span className="md:hidden">Join</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 sm:w-96 max-h-[70vh] overflow-y-auto p-0"
      >
        {/* Section 1: Today's Sessions */}
        <div className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Today&apos;s Sessions
          </p>
          <TodaysSessionsList onSessionClick={handleSessionClick} />
        </div>

        <Separator />

        {/* Section 2: Browse by Relationship */}
        <div className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Browse Sessions
          </p>
          <RelationshipSessionBrowser onSessionClick={handleSessionClick} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
