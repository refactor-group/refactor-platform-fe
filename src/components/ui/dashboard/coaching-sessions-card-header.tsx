"use client";

import { Clock, List, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/lib/utils";
import type { Id } from "@/types/general";

export interface RelationshipOption {
  id: Id;
  label: string;
}

type SessionView = "list" | "timeline";

export interface CoachingSessionsCardHeaderProps {
  relationshipFilter: Id | undefined;
  onRelationshipFilterChange: (id: Id | undefined) => void;
  relationshipOptions: RelationshipOption[];
  selectedRelationshipLabel: string | undefined;
}

const ALL_RELATIONSHIPS = "all";

export function CoachingSessionsCardHeader({
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
  selectedRelationshipLabel,
}: CoachingSessionsCardHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <h2 className="text-base font-semibold">Coaching Sessions</h2>

      <div className="flex items-center gap-2 flex-wrap">
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
        <Select
          value={relationshipFilter ?? ALL_RELATIONSHIPS}
          onValueChange={(v) =>
            onRelationshipFilterChange(
              v === ALL_RELATIONSHIPS ? undefined : v
            )
          }
          disabled={relationshipOptions.length === 0}
        >
          <SelectTrigger
            className="h-7 text-xs w-auto min-w-[140px] gap-1.5"
            aria-label="Relationship filter"
          >
            <SelectValue placeholder="All relationships" />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL_RELATIONSHIPS}>
              All relationships
            </SelectItem>
            {relationshipOptions.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewToggle />
      </div>
    </div>
  );
}

function ViewToggle() {
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
