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
    >
      <ToggleGroupItem value={AssignedActionsFilter.DueSoon}>
        Due Soon
      </ToggleGroupItem>
      <ToggleGroupItem value={AssignedActionsFilter.AllIncomplete}>
        All Incomplete
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
