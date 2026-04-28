"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import { type DurationObject } from "ts-luxon";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Id } from "@/types/general";

// Time-window options for the Filters popover. The same window is applied
// symmetrically to both tabs:
//   Upcoming = [now, now + window)   sorted ascending
//   Previous = (now − window, now]   sorted descending
export enum SessionTimeWindow {
  Day = "24h",
  Week = "7d",
  Month = "30d",
  Quarter = "90d",
}

export const TIME_WINDOW_DURATIONS: Record<SessionTimeWindow, DurationObject> = {
  [SessionTimeWindow.Day]: { hours: 24 },
  [SessionTimeWindow.Week]: { days: 7 },
  [SessionTimeWindow.Month]: { days: 30 },
  [SessionTimeWindow.Quarter]: { days: 90 },
};

export const TIME_WINDOW_LABELS: Record<SessionTimeWindow, string> = {
  [SessionTimeWindow.Day]: "24 hours",
  [SessionTimeWindow.Week]: "7 days",
  [SessionTimeWindow.Month]: "30 days",
  [SessionTimeWindow.Quarter]: "90 days",
};

export interface RelationshipOption {
  id: Id;
  label: string;
}

export interface FiltersPopoverProps {
  timeWindow: SessionTimeWindow;
  onTimeWindowChange: (w: SessionTimeWindow) => void;
  relationshipFilter: Id | undefined;
  onRelationshipFilterChange: (id: Id | undefined) => void;
  relationshipOptions: RelationshipOption[];
}

export function FiltersPopover({
  timeWindow,
  onTimeWindowChange,
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
}: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          aria-label="Filters"
        >
          <ListFilter className="h-3.5 w-3.5" />
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-4"
        onInteractOutside={(e) => {
          // Keep the popover open while interacting with Select dropdowns
          // (their content portals outside this Popover).
          const target = e.target as HTMLElement | null;
          if (target?.closest?.('[role="listbox"]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="space-y-4">
          {/* Time window — applied symmetrically to both tabs */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Time window
            </Label>
            <Select
              value={timeWindow}
              onValueChange={(v) => onTimeWindowChange(v as SessionTimeWindow)}
            >
              <SelectTrigger
                className="w-full h-7 text-xs"
                aria-label="Time window"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.values(SessionTimeWindow) as SessionTimeWindow[]).map(
                  (w) => (
                    <SelectItem key={w} value={w}>
                      {TIME_WINDOW_LABELS[w]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship — narrows both lists to a single coachee/coach */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Relationship
            </Label>
            <Select
              value={relationshipFilter ?? "all"}
              onValueChange={(v) =>
                onRelationshipFilterChange(v === "all" ? undefined : v)
              }
            >
              <SelectTrigger
                className="w-full h-7 text-xs"
                aria-label="Relationship filter"
              >
                <SelectValue placeholder="All relationships" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All relationships</SelectItem>
                {relationshipOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
