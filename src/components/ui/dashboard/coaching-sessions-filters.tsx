"use client";

import { useState } from "react";
import { ListFilter } from "lucide-react";
import { type DateTime, type DurationObject } from "ts-luxon";
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

// Natural-language window sizes. The symmetry-around-now signal is carried
// by the resolved date range shown beneath each option (and in the header
// chip), so the abstract label can stay short and conversational.
export const TIME_WINDOW_LABELS: Record<SessionTimeWindow, string> = {
  [SessionTimeWindow.Day]: "1 day",
  [SessionTimeWindow.Week]: "1 week",
  [SessionTimeWindow.Month]: "1 month",
  [SessionTimeWindow.Quarter]: "3 months",
};

/**
 * Resolves a `SessionTimeWindow` into a concrete calendar-date range string,
 * relative to a given `now`. Used for surfaces that benefit from concreteness
 * — the header's active-state chip and (as a secondary line) each dropdown
 * option — while the abstract `TIME_WINDOW_LABELS` remain the primary label.
 *
 * Format: `MMM d – MMM d` when both ends are in the same year; falls back to
 * `MMM d, yyyy – MMM d, yyyy` when the range crosses a year boundary
 * (only realistic at ±90d near year-end). Day-of-month digits stay tabular
 * via `tabular-nums` at the call site if vertical alignment matters.
 */
export function formatTimeWindowDateRange(
  window: SessionTimeWindow,
  now: DateTime
): string {
  const duration = TIME_WINDOW_DURATIONS[window];
  const from = now.minus(duration);
  const to = now.plus(duration);
  const fmt = from.year === to.year ? "LLL d" : "LLL d, yyyy";
  return `${from.toFormat(fmt)} – ${to.toFormat(fmt)}`;
}

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
  /** Anchor for resolving each dropdown option into a concrete date range.
   *  Sourced from the card's `mountNow` so the displayed ranges match the
   *  data the user will see on selection — single source of truth for
   *  "what does the data fetch consider 'now'?". */
  now: DateTime;
}

export function FiltersPopover({
  timeWindow,
  onTimeWindowChange,
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
  now,
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
          {/* Time range — applied symmetrically to both tabs */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Time Range
            </Label>
            <Select
              value={timeWindow}
              onValueChange={(v) => onTimeWindowChange(v as SessionTimeWindow)}
            >
              <SelectTrigger
                className="w-full h-7 text-xs"
                aria-label="Time Range"
              >
                {/* Render the trigger content explicitly instead of using
                    `<SelectValue />`. Radix's `<SelectValue />` clones the
                    selected `<SelectItem>`'s children verbatim — which
                    means our two-line `flex flex-col` (abstract label +
                    date hint) would render stacked inside the 28px-tall
                    trigger, distorting its height and making it
                    inconsistent with the Relationship select below. The
                    Select is controlled (`value={timeWindow}`), so we
                    can render the abstract label directly here. The
                    stacked layout still renders inside each option in
                    `<SelectContent>` — that's the "preview" surface. */}
                <span>{TIME_WINDOW_LABELS[timeWindow]}</span>
              </SelectTrigger>
              <SelectContent>
                {/* Each option pairs the abstract size with the concrete
                    resolved range for that size against `now`. The abstract
                    label is the primary read; the date range is a small
                    secondary hint that previews what the user will get on
                    selection — matches the chip's date-range display.
                    `textValue` is kept so Radix's type-ahead matching
                    uses the abstract label instead of the concatenated
                    "{abstract}{date-range}" textContent. */}
                {(Object.values(SessionTimeWindow) as SessionTimeWindow[]).map(
                  (w) => (
                    <SelectItem
                      key={w}
                      value={w}
                      textValue={TIME_WINDOW_LABELS[w]}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span>{TIME_WINDOW_LABELS[w]}</span>
                        <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                          {formatTimeWindowDateRange(w, now)}
                        </span>
                      </div>
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/70 leading-snug">
              Past and upcoming sessions relative to now.
            </p>
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
