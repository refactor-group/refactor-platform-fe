"use client";

import { Clock, List, X } from "lucide-react";
import { type DateTime } from "ts-luxon";
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
  formatTimeWindowDateRange,
  type RelationshipOption,
} from "@/components/ui/dashboard/coaching-sessions-filters";
import { defaultInitState as filterStoreDefaults } from "@/lib/stores/coaching-sessions-card-filter-store";
import type { Id } from "@/types/general";

// Single source of truth for "what's the default time range?" — bound to
// the persisted store's defaults so changing the default in one place can
// never desynchronize the chip's reset behavior from the actual default.
const DEFAULT_TIME_WINDOW = filterStoreDefaults.timeWindow;

type SessionView = "list" | "timeline";

export interface CoachingSessionsCardHeaderProps {
  timeWindow: SessionTimeWindow;
  onTimeWindowChange: (w: SessionTimeWindow) => void;
  relationshipFilter: Id | undefined;
  onRelationshipFilterChange: (id: Id | undefined) => void;
  relationshipOptions: RelationshipOption[];
  selectedRelationshipLabel: string | undefined;
  /** The same `mountNow` the card uses to drive its session fetch. Anchors
   *  the chip's resolved date range so chip text and visible rows always
   *  agree, even if `DateTime.now()` would have shifted between mount and
   *  this render. */
  now: DateTime;
}

export function CoachingSessionsCardHeader({
  timeWindow,
  onTimeWindowChange,
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
  selectedRelationshipLabel,
  now,
}: CoachingSessionsCardHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <h2 className="text-base font-semibold">Coaching Sessions</h2>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Time-window chip shows the *resolved* calendar range (e.g.
            "Apr 27 – May 11"), not the abstract size — answers "what am I
            looking at right now?" more concretely. The dropdown options
            keep the abstract size as their primary label since the user
            is choosing window *size*, not specific dates. X resets to
            whatever the store defaults to (sourced from
            `defaultInitState`, currently a 1-week span). */}
        <Badge variant="secondary" className="gap-1 text-xs h-7 pl-2.5 pr-1.5 tabular-nums">
          {formatTimeWindowDateRange(timeWindow, now)}
          {timeWindow !== DEFAULT_TIME_WINDOW && (
            <button
              type="button"
              aria-label="Reset time window to default"
              onClick={() => onTimeWindowChange(DEFAULT_TIME_WINDOW)}
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
          now={now}
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
