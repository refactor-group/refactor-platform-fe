"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AssignedActionsFilter } from "@/types/assigned-actions";

interface WhatsDueFilterProps {
  value: AssignedActionsFilter;
  onChange: (value: AssignedActionsFilter) => void;
}

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
      >
        Due Soon
      </ToggleGroupItem>
      <ToggleGroupItem
        value={AssignedActionsFilter.AllIncomplete}
        className="whitespace-nowrap text-xs px-2 h-7 rounded-none border-r-0"
      >
        Incomplete
      </ToggleGroupItem>
      <ToggleGroupItem
        value={AssignedActionsFilter.AllUnassigned}
        className="whitespace-nowrap text-xs px-2 h-7 rounded-l-none"
      >
        Unassigned
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
