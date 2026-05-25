"use client";

import { useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
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
import { CoachingSessionBuckets } from "@/lib/utils/session";
import { CoachingSessionBucketView } from "@/types/coaching-session-bucket";
import {
  isPastSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface ThisWeekAccordionProps {
  view: CoachingSessionBucketView;
  mountNow: DateTime;
  /** Ticking now — drives the past/future cutoff inside this week so a
   *  session migrates between Upcoming and Previous as soon as it ends. */
  now: DateTime;
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

export function ThisWeekAccordion({
  view,
  mountNow,
  now,
  userId,
  relationshipId,
  viewerId,
  userTimezone,
  selectedId,
  onSelect,
  onReschedule,
  onRequestDelete,
}: ThisWeekAccordionProps) {
  const isPastView = view === CoachingSessionBucketView.Previous;
  const [isExpanded, setIsExpanded] = useState(true);

  const range = useMemo(
    () => CoachingSessionBuckets.currentWeekRange(mountNow),
    [mountNow]
  );

  // BE sort: ascending for Upcoming, descending for Previous. The FE
  // past/future filter below preserves the ordering.
  const { enrichedSessions, isLoading } = useEnrichedCoachingSessionsForUser(
    userId,
    range.start,
    range.end,
    SESSION_INCLUDES,
    "date",
    isPastView ? "desc" : "asc",
    relationshipId,
    userTimezone
  );

  const filteredSessions = useMemo(() => {
    const all = enrichedSessions ?? [];
    return isPastView
      ? all.filter((s) => isPastSession(s, { now }))
      : all.filter((s) => !isPastSession(s, { now }));
  }, [enrichedSessions, isPastView, now]);

  // Hide the accordion entirely once we've fetched and there's nothing
  // matching the view. Avoids a stray empty collapsible eating vertical
  // space — TODAY's own empty state covers the "nothing here" case.
  if (!isLoading && filteredSessions.length === 0) {
    return null;
  }

  const rangeLabel = CoachingSessionBuckets.formatLabel(range.start, range.end);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="group"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between gap-3 px-6 py-3 hover:bg-muted/20 transition-colors text-left"
        >
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 transition-colors group-hover:text-muted-foreground truncate">
              This Week · {rangeLabel}
            </span>
            {filteredSessions.length > 0 && (
              <span className="text-xs tabular-nums text-muted-foreground/60 transition-colors group-hover:text-muted-foreground">
                ({filteredSessions.length})
              </span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-muted-foreground duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading && filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center py-4 px-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
          </div>
        ) : (
          <div className="px-6 divide-y">
            {filteredSessions.map((session) => (
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
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
