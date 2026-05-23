"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/components/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SessionRow } from "@/components/ui/dashboard/coaching-sessions-row";
import {
  CoachingSessionInclude,
  useEnrichedCoachingSessionsForUser,
} from "@/lib/api/coaching-sessions";
import { calculateSessionUrgency } from "@/lib/utils/session";
import { Some } from "@/types/option";
import {
  CoachingSessionBucketCount,
  CoachingSessionBucketDescriptor,
  CoachingSessionBucketView,
} from "@/types/coaching-session-bucket";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { SessionUrgency } from "@/types/session-display";

export interface BucketAccordionProps {
  descriptor: CoachingSessionBucketDescriptor;
  /** View-aware display label — the overlap bucket renders a clipped
   *  range (e.g., "May 23 – Jun 30" in Upcoming) instead of the full
   *  calendar window the descriptor records. Non-overlap buckets pass
   *  `descriptor.label`. */
  label: string;
  count: CoachingSessionBucketCount;
  view: CoachingSessionBucketView;
  isExpanded: boolean;
  onToggle: () => void;
  userId: Id;
  relationshipId: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  selectedId: Id | undefined;
  onSelect: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
}

const SESSION_INCLUDES: CoachingSessionInclude[] = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Goal,
];

function matchesView(
  session: EnrichedCoachingSession,
  view: CoachingSessionBucketView
): boolean {
  const isPast = calculateSessionUrgency(session) === SessionUrgency.Past;
  return view === CoachingSessionBucketView.Previous ? isPast : !isPast;
}

export function BucketAccordion({
  descriptor,
  label,
  count,
  view,
  isExpanded,
  onToggle,
  userId,
  relationshipId,
  viewerId,
  userTimezone,
  selectedId,
  onSelect,
  onReschedule,
  onRequestDelete,
}: BucketAccordionProps) {
  const [hasEverExpanded, setHasEverExpanded] = useState(isExpanded);

  if (isExpanded && !hasEverExpanded) {
    setHasEverExpanded(true);
  }

  const { enrichedSessions, isLoading } = useEnrichedCoachingSessionsForUser(
    hasEverExpanded ? userId : null,
    descriptor.start,
    descriptor.end,
    SESSION_INCLUDES,
    undefined,
    undefined,
    relationshipId
  );

  const filteredSessions = (enrichedSessions ?? []).filter((s) =>
    matchesView(s, view)
  );

  // Once we've fetched, prefer the view-filtered count over the BE total.
  // For pure past/future buckets these match; for the overlap (current)
  // bucket they diverge — the visible badge should agree with the row count.
  const displayCount: CoachingSessionBucketCount =
    enrichedSessions && enrichedSessions.length > 0
      ? Some(filteredSessions.length)
      : count;

  // Hide the accordion entirely when the view filter empties an
  // otherwise non-empty bucket — relevant only for the overlap bucket
  // (BE-zero buckets are already filtered upstream by `BucketList`).
  // We require `hasEverExpanded` so we don't hide collapsed buckets we
  // haven't fetched yet on the strength of an empty initial `[]`.
  if (hasEverExpanded && !isLoading && filteredSessions.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20 transition-colors text-left"
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[13px] font-medium text-foreground truncate">
              {label}
            </span>
            {displayCount.some && (
              <span className="text-xs text-muted-foreground tabular-nums">
                ({displayCount.val})
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <BucketBody
          sessions={filteredSessions}
          isLoading={isLoading}
          view={view}
          viewerId={viewerId}
          userTimezone={userTimezone}
          selectedId={selectedId}
          onSelect={onSelect}
          onReschedule={onReschedule}
          onRequestDelete={onRequestDelete}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

interface BucketBodyProps {
  sessions: EnrichedCoachingSession[];
  isLoading: boolean;
  view: CoachingSessionBucketView;
  viewerId: Id;
  userTimezone: string;
  selectedId: Id | undefined;
  onSelect: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
}

function BucketBody({
  sessions,
  isLoading,
  view,
  viewerId,
  userTimezone,
  selectedId,
  onSelect,
  onReschedule,
  onRequestDelete,
}: BucketBodyProps) {
  if (isLoading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-4 px-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="px-6 py-4 text-sm text-muted-foreground/60">
        No sessions in this range.
      </p>
    );
  }

  const isPastView = view === CoachingSessionBucketView.Previous;

  return (
    <div className="px-6 divide-y">
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          viewerId={viewerId}
          userTimezone={userTimezone}
          isPast={isPastView}
          isSelected={selectedId === session.id}
          onSelect={() => onSelect(session)}
          onReschedule={onReschedule}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}
