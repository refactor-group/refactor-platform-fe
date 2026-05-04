"use client";

import { Clock, List, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import {
  FiltersPopover,
  SessionTimeWindow,
  TIME_WINDOW_LABELS,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-filters";
import type { Id } from "@/types/general";

type SessionView = "list" | "timeline";

export interface CoachingSessionsCardHeaderProps {
  timeWindow: SessionTimeWindow;
  onTimeWindowChange: (w: SessionTimeWindow) => void;
  relationshipFilter: Id | undefined;
  onRelationshipFilterChange: (id: Id | undefined) => void;
  relationshipOptions: RelationshipOption[];
  selectedRelationshipLabel: string | undefined;
}

export function CoachingSessionsCardHeader({
  timeWindow,
  onTimeWindowChange,
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
  selectedRelationshipLabel,
}: CoachingSessionsCardHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <h2 className="text-base font-semibold">Coaching Sessions</h2>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Time-window chip is always shown so the user can see the current
            window at a glance. X resets to the default (24 hours). */}
        <Badge variant="secondary" className="gap-1 text-xs h-7 pl-2.5 pr-1.5">
          {TIME_WINDOW_LABELS[timeWindow]}
          {timeWindow !== SessionTimeWindow.Day && (
            <button
              type="button"
              aria-label="Reset time window to default"
              onClick={() => onTimeWindowChange(SessionTimeWindow.Day)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
        {selectedRelationshipLabel && (
          <Badge
            variant="secondary"
            className="gap-1 text-xs h-7 pl-2.5 pr-1.5"
          >
            {selectedRelationshipLabel}
            <button
              type="button"
              aria-label="Clear relationship filter"
              onClick={() => onRelationshipFilterChange(undefined)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        <FiltersPopover
          timeWindow={timeWindow}
          onTimeWindowChange={onTimeWindowChange}
          relationshipFilter={relationshipFilter}
          onRelationshipFilterChange={onRelationshipFilterChange}
          relationshipOptions={relationshipOptions}
        />
        <ViewToggle />
      </div>
    </div>
  );
}

function ViewToggle() {
  // Only the List view is wired in this PR; the Clock button is placed for
  // PR 3d (timeline view) but disabled until then.
  const view: SessionView = "list";

  return (
    <div className="flex items-center rounded-md border p-0.5">
      <button
        type="button"
        className={cn(
          "rounded-sm p-1.5 transition-colors",
          view === "list"
            ? "bg-muted text-foreground"
            : "text-muted-foreground/50 hover:text-muted-foreground"
        )}
        aria-label="List view"
        aria-pressed={view === "list"}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper so Tooltip still fires on a disabled button (Radix
              tooltips ignore pointer events on disabled elements). */}
          <span tabIndex={0}>
            <button
              type="button"
              disabled
              className="rounded-sm p-1.5 text-muted-foreground/40 cursor-not-allowed"
              aria-label="Timeline view"
              aria-pressed={false}
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Timeline view coming soon</TooltipContent>
      </Tooltip>
    </div>
  );
}
