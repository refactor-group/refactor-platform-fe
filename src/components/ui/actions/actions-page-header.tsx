"use client";

import { useState } from "react";
import { ListFilter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CoachViewMode,
  StatusVisibility,
  TimeRange,
} from "@/types/assigned-actions";
import type { Id, SelectOption } from "@/types/general";

interface ActionsPageHeaderProps {
  isCoach: boolean;
  viewMode: CoachViewMode;
  onViewModeChange: (mode: CoachViewMode) => void;
  statusVisibility: StatusVisibility;
  onStatusVisibilityChange: (vis: StatusVisibility) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  relationshipId: Id | undefined;
  onRelationshipChange: (id: Id | undefined) => void;
  relationships: SelectOption[];
}

export function ActionsPageHeader({
  isCoach,
  viewMode,
  onViewModeChange,
  statusVisibility,
  onStatusVisibilityChange,
  timeRange,
  onTimeRangeChange,
  relationshipId,
  onRelationshipChange,
  relationships,
}: ActionsPageHeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const selectedRelationshipLabel = relationshipId
    ? relationships.find((r) => r.id === relationshipId)?.label
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>

      <div className="flex flex-wrap items-center gap-3">
        {isCoach && (
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => {
              if (v) onViewModeChange(v as CoachViewMode);
            }}
            variant="outline"
            size="sm"
            className="gap-0"
          >
            <ToggleGroupItem
              value={CoachViewMode.MyActions}
              className="whitespace-nowrap text-xs px-2 h-7 rounded-r-none border-r-0"
            >
              My Actions
            </ToggleGroupItem>
            <ToggleGroupItem
              value={CoachViewMode.CoacheeActions}
              className="whitespace-nowrap text-xs px-2 h-7 rounded-l-none"
            >
              Coachee Actions
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        <div className="flex-1" />

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
              <ListFilter className="h-3.5 w-3.5" />
              Filters
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-72 p-4"
            onInteractOutside={(e) => {
              // Prevent closing when interacting with Select dropdown portals
              const target = e.target as HTMLElement | null;
              if (target?.closest?.('[role="listbox"]')) {
                e.preventDefault();
              }
            }}
          >
            <div className="space-y-4">
              {/* Status visibility */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <ToggleGroup
                  type="single"
                  value={statusVisibility}
                  onValueChange={(v) => {
                    if (v) onStatusVisibilityChange(v as StatusVisibility);
                  }}
                  variant="outline"
                  size="sm"
                  className="gap-0 w-full"
                >
                  <ToggleGroupItem
                    value={StatusVisibility.Open}
                    className="whitespace-nowrap text-xs px-2 h-7 rounded-r-none border-r-0 flex-1"
                  >
                    Open
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value={StatusVisibility.All}
                    className="whitespace-nowrap text-xs px-2 h-7 rounded-none border-r-0 flex-1"
                  >
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value={StatusVisibility.Closed}
                    className="whitespace-nowrap text-xs px-2 h-7 rounded-l-none flex-1"
                  >
                    Closed
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Time range */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Time Range</Label>
                <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as TimeRange)}>
                  <SelectTrigger className="w-full h-7 text-xs" aria-label="Time range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TimeRange.Last30Days}>Last 30 days</SelectItem>
                    <SelectItem value={TimeRange.Last90Days}>Last 90 days</SelectItem>
                    <SelectItem value={TimeRange.AllTime}>All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Relationship filter */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Relationship</Label>
                <Select
                  value={relationshipId ?? "all"}
                  onValueChange={(v) => onRelationshipChange(v === "all" ? undefined : v)}
                >
                  <SelectTrigger className="w-full h-7 text-xs" aria-label="Relationship filter">
                    <SelectValue placeholder="All relationships" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All relationships</SelectItem>
                    {relationships.map((r) => (
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

        {selectedRelationshipLabel && (
          <Badge variant="secondary" className="gap-1 text-xs h-7 pl-2.5 pr-1.5">
            {selectedRelationshipLabel}
            <button
              type="button"
              aria-label="Clear relationship filter"
              onClick={() => onRelationshipChange(undefined)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>
    </div>
  );
}
