"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CoachViewMode,
  StatusVisibility,
  TimeRange,
  TimeField,
} from "@/types/assigned-actions";
import type { Id } from "@/types/general";

interface RelationshipOption {
  id: Id;
  label: string;
}

interface ActionsPageHeaderProps {
  isCoach: boolean;
  viewMode: CoachViewMode;
  onViewModeChange: (mode: CoachViewMode) => void;
  statusVisibility: StatusVisibility;
  onStatusVisibilityChange: (vis: StatusVisibility) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  timeField: TimeField;
  onTimeFieldChange: (field: TimeField) => void;
  relationshipId: Id | undefined;
  onRelationshipChange: (id: Id | undefined) => void;
  relationships: RelationshipOption[];
}

export function ActionsPageHeader({
  isCoach,
  viewMode,
  onViewModeChange,
  statusVisibility,
  onStatusVisibilityChange,
  timeRange,
  onTimeRangeChange,
  timeField,
  onTimeFieldChange,
  relationshipId,
  onRelationshipChange,
  relationships,
}: ActionsPageHeaderProps) {
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

        {/* Status visibility */}
        <ToggleGroup
          type="single"
          value={statusVisibility}
          onValueChange={(v) => {
            if (v) onStatusVisibilityChange(v as StatusVisibility);
          }}
          variant="outline"
          size="sm"
          className="gap-0"
        >
          <ToggleGroupItem
            value={StatusVisibility.Open}
            className="whitespace-nowrap text-xs px-2 h-7 rounded-r-none border-r-0"
          >
            Open
          </ToggleGroupItem>
          <ToggleGroupItem
            value={StatusVisibility.All}
            className="whitespace-nowrap text-xs px-2 h-7 rounded-none border-r-0"
          >
            All
          </ToggleGroupItem>
          <ToggleGroupItem
            value={StatusVisibility.Closed}
            className="whitespace-nowrap text-xs px-2 h-7 rounded-l-none"
          >
            Closed
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Time range */}
        <Select value={timeRange} onValueChange={(v) => onTimeRangeChange(v as TimeRange)}>
          <SelectTrigger className="w-[140px] h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TimeRange.Last30Days}>Last 30 days</SelectItem>
            <SelectItem value={TimeRange.Last90Days}>Last 90 days</SelectItem>
            <SelectItem value={TimeRange.AllTime}>All time</SelectItem>
          </SelectContent>
        </Select>

        {/* Time field toggle */}
        <ToggleGroup
          type="single"
          value={timeField}
          onValueChange={(v) => {
            if (v) onTimeFieldChange(v as TimeField);
          }}
          variant="outline"
          size="sm"
          className="gap-0"
        >
          <ToggleGroupItem
            value={TimeField.DueDate}
            className="whitespace-nowrap text-xs px-2 h-7 rounded-r-none border-r-0"
          >
            Due date
          </ToggleGroupItem>
          <ToggleGroupItem
            value={TimeField.CreatedDate}
            className="whitespace-nowrap text-xs px-2 h-7 rounded-l-none"
          >
            Created date
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Relationship filter */}
        <Select
          value={relationshipId ?? "all"}
          onValueChange={(v) => onRelationshipChange(v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-[200px] h-7 text-xs">
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
  );
}
