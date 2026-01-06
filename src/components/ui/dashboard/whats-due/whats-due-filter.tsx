"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AssignedActionsFilter } from "@/types/assigned-actions";

interface WhatsDueFilterProps {
  value: AssignedActionsFilter;
  onChange: (value: AssignedActionsFilter) => void;
}

const filterDescriptions: Record<AssignedActionsFilter, string> = {
  [AssignedActionsFilter.DueSoon]: "Actions due before the next session",
  [AssignedActionsFilter.AllIncomplete]: "All incomplete actions assigned to you",
  [AssignedActionsFilter.AllUnassigned]: "Actions with no assignee",
  [AssignedActionsFilter.Completed]: "Actions completed since last session",
};

export function WhatsDueFilter({ value, onChange }: WhatsDueFilterProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onChange(newValue as AssignedActionsFilter);
      }}
      variant="outline"
      size="sm"
      className="gap-0"
    >
      <ToggleGroupItem
        value={AssignedActionsFilter.DueSoon}
        className="whitespace-nowrap text-xs px-2 h-7 rounded-r-none border-r-0"
        title={filterDescriptions[AssignedActionsFilter.DueSoon]}
      >
        Due Soon
      </ToggleGroupItem>
      <ToggleGroupItem
        value={AssignedActionsFilter.AllIncomplete}
        className="whitespace-nowrap text-xs px-2 h-7 rounded-none border-r-0"
        title={filterDescriptions[AssignedActionsFilter.AllIncomplete]}
      >
        Incomplete
      </ToggleGroupItem>
      <ToggleGroupItem
        value={AssignedActionsFilter.AllUnassigned}
        className="whitespace-nowrap text-xs px-2 h-7 rounded-none border-r-0"
        title={filterDescriptions[AssignedActionsFilter.AllUnassigned]}
      >
        Unassigned
      </ToggleGroupItem>
      <ToggleGroupItem
        value={AssignedActionsFilter.Completed}
        className="whitespace-nowrap text-xs px-2 h-7 rounded-l-none"
        title={filterDescriptions[AssignedActionsFilter.Completed]}
      >
        Completed
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
