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
import {
  CoachingSessionBucketCount,
  CoachingSessionBucketDescriptor,
  CoachingSessionBucketKind,
} from "@/types/coaching-session-bucket";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { SessionUrgency } from "@/types/session-display";

export interface BucketAccordionProps {
  descriptor: CoachingSessionBucketDescriptor;
  count: CoachingSessionBucketCount;
  isExpanded: boolean;
  onToggle: () => void;
  userId: Id;
  relationshipId: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  hoveredId: Id | undefined;
  onHover: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
}

const SESSION_INCLUDES: CoachingSessionInclude[] = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Goal,
];

export function BucketAccordion({
  descriptor,
  count,
  isExpanded,
  onToggle,
  userId,
  relationshipId,
  viewerId,
  userTimezone,
  hoveredId,
  onHover,
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

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20 transition-colors text-left"
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[13px] font-medium text-foreground truncate">
              {descriptor.label}
            </span>
            {count.some && (
              <span className="text-xs text-muted-foreground tabular-nums">
                ({count.val})
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
          sessions={enrichedSessions ?? []}
          isLoading={isLoading}
          isPast={descriptor.kind === CoachingSessionBucketKind.Past}
          viewerId={viewerId}
          userTimezone={userTimezone}
          hoveredId={hoveredId}
          onHover={onHover}
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
  isPast: boolean;
  viewerId: Id;
  userTimezone: string;
  hoveredId: Id | undefined;
  onHover: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
}

function BucketBody({
  sessions,
  isLoading,
  isPast,
  viewerId,
  userTimezone,
  hoveredId,
  onHover,
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

  return (
    <div className="px-6 divide-y">
      {sessions.map((session) => {
        const rowIsPast =
          isPast ||
          calculateSessionUrgency(session) === SessionUrgency.Past;
        return (
          <SessionRow
            key={session.id}
            session={session}
            viewerId={viewerId}
            userTimezone={userTimezone}
            isPast={rowIsPast}
            isHovered={hoveredId === session.id}
            onHover={() => onHover(session)}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
          />
        );
      })}
    </div>
  );
}
