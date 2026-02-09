"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "ts-luxon";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/components/lib/utils";
import { PulsingDot } from "@/components/ui/pulsing-dot";

import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import {
  useEnrichedCoachingSessionsForUser,
  CoachingSessionInclude,
} from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";

import {
  calculateSessionUrgency,
  getUrgencyMessage,
  formatSessionTime,
  getSessionParticipantName,
} from "@/lib/utils/session";
import {
  formatDateInUserTimezone,
  getBrowserTimezone,
} from "@/lib/timezone-utils";
import { getDateTimeFromString } from "@/types/general";

import {
  getRelationshipsAsCoach,
  getRelationshipsAsCoachee,
  getOtherPersonName,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { SessionUrgency } from "@/types/session-display";
import type { Id } from "@/types/general";

// ---------------------------------------------------------------------------
// Section 1: Today's Sessions
// ---------------------------------------------------------------------------

function TodaysSessionsList({
  sessions,
  isLoading,
  error,
  onSessionClick,
}: {
  sessions: EnrichedCoachingSession[];
  isLoading: boolean;
  error: Error | undefined;
  onSessionClick: (sessionId: string) => void;
}) {
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
    <div className="flex flex-col gap-1 max-h-[17.5rem] overflow-y-auto p-0.5 -m-0.5">
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
                {getSessionParticipantName(session, userId)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatSessionTime(session.date, timezone)}
              </span>
            </div>
            <span
              className={cn(
                "text-xs flex items-center gap-1.5",
                urgency === SessionUrgency.Underway || urgency === SessionUrgency.Imminent
                  ? "text-foreground font-bold"
                  : "text-muted-foreground"
              )}
            >
              {(urgency === SessionUrgency.Underway || urgency === SessionUrgency.Imminent) && (
                <PulsingDot />
              )}
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

type DateFilter = "last_month" | "week" | "month";

function getDateRange(filter: DateFilter): { from: DateTime; to: DateTime } {
  const now = DateTime.now();
  switch (filter) {
    case "last_month":
      return { from: now.minus({ months: 1 }).startOf("month"), to: now.minus({ months: 1 }).endOf("month") };
    case "week":
      return { from: now.startOf("week"), to: now.endOf("week") };
    case "month":
      return { from: now.startOf("month"), to: now.endOf("month") };
  }
}

function RelationshipSessionBrowser({
  onSessionClick,
  browsingRelationshipId: browsingRelationshipIdProp,
  onRelationshipChange,
}: {
  onSessionClick: (sessionId: string) => void;
  browsingRelationshipId: string | undefined;
  onRelationshipChange: (relationshipId: string) => void;
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");

  const { userId, userSession } = useAuthStore((state) => ({
    userId: state.userId,
    userSession: state.userSession,
  }));
  const timezone = userSession?.timezone || getBrowserTimezone();

  const { currentOrganizationId } = useCurrentOrganization();
  const {
    currentCoachingRelationshipId,
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

  const sortedRelationships = sortRelationshipsByParticipantName(uniqueRelationships, userId);

  // Use the parent-provided value, falling back to the global relationship
  const selectedRelationshipId =
    browsingRelationshipIdProp ?? currentCoachingRelationshipId ?? undefined;

  const { from, to } = getDateRange(dateFilter);

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={selectedRelationshipId}
        onValueChange={onRelationshipChange}
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

      <div className="flex gap-1">
        {([
          { value: "last_month", label: "Last Month" },
          { value: "week", label: "This Week" },
          { value: "month", label: "This Month" },
        ] as const).map(({ value, label }) => (
          <Button
            key={value}
            variant={dateFilter === value ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => setDateFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {selectedRelationshipId && (
        <RelationshipSessionList
          userId={userId}
          relationshipId={selectedRelationshipId}
          fromDate={from}
          toDate={to}
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
  fromDate,
  toDate,
  timezone,
  onSessionClick,
}: {
  userId: string;
  relationshipId: string;
  fromDate: DateTime;
  toDate: DateTime;
  timezone: string;
  onSessionClick: (sessionId: string) => void;
}) {
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
      <p className="text-sm text-muted-foreground py-2 pl-2">No sessions found</p>
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
    <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
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

  const { sessions, isLoading, error } = useTodaysSessions([
    CoachingSessionInclude.Relationship,
    CoachingSessionInclude.Goal,
  ]);

  // Collapse browse section when today has sessions, expand when empty
  const hasTodaySessions = !isLoading && !error && sessions.length > 0;
  const [browseOpen, setBrowseOpen] = useState(!hasTodaySessions);

  // Browsing relationship state lives here so it survives SelectContent
  // portal interactions and child re-renders
  const [browsingRelationshipId, setBrowsingRelationshipId] = useState<
    string | undefined
  >(undefined);

  const handleSessionClick = (sessionId: string) => {
    setOpen(false);
    router.push(`/coaching-sessions/${sessionId}`);
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      // Reset browse section state when popover opens
      if (isOpen) {
        setBrowseOpen(!hasTodaySessions);
        // Reset browsing relationship so it re-derives from global state on open
        setBrowsingRelationshipId(undefined);
      }
    }}>
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
        onInteractOutside={(e) => {
          // Prevent popover from closing when interacting with Select dropdown portals
          const target = e.target as HTMLElement | null;
          if (target?.closest?.('[role="listbox"]')) {
            e.preventDefault();
          }
        }}
      >
        {/* Section 1: Today's Sessions */}
        <div className="p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Today&apos;s Sessions
          </p>
          <TodaysSessionsList
            sessions={sessions}
            isLoading={isLoading}
            error={error}
            onSessionClick={handleSessionClick}
          />
        </div>

        <Separator />

        {/* Section 2: Browse by Relationship (collapsible) */}
        <Collapsible open={browseOpen} onOpenChange={setBrowseOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between p-3 hover:bg-accent/50 transition-colors">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Browse Sessions
            </p>
            <ChevronRight className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              browseOpen && "rotate-90"
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pt-1 pb-3">
              <RelationshipSessionBrowser
                onSessionClick={handleSessionClick}
                browsingRelationshipId={browsingRelationshipId}
                onRelationshipChange={setBrowsingRelationshipId}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </PopoverContent>
    </Popover>
  );
}
