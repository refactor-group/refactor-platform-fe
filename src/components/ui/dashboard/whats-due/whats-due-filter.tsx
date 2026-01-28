"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignedActionsFilter, CoachViewMode } from "@/types/assigned-actions";

interface WhatsDueFilterProps {
  value: AssignedActionsFilter;
  onChange: (value: AssignedActionsFilter) => void;
  viewMode?: CoachViewMode;
}

const filterOptions = [
  {
    value: AssignedActionsFilter.DueSoon,
    label: "Due Soon",
  },
  {
    value: AssignedActionsFilter.AllIncomplete,
    label: "Incomplete",
  },
  {
    value: AssignedActionsFilter.AllUnassigned,
    label: "Unassigned",
  },
  {
    value: AssignedActionsFilter.Completed,
    label: "Completed",
  },
];

export function WhatsDueFilter({ value, onChange, viewMode }: WhatsDueFilterProps) {
  // Hide "Unassigned" filter when viewing coachee actions
  const availableOptions = viewMode === CoachViewMode.CoacheeActions
    ? filterOptions.filter((opt) => opt.value !== AssignedActionsFilter.AllUnassigned)
    : filterOptions;

  return (
    <Select
      value={value}
      onValueChange={(newValue) => onChange(newValue as AssignedActionsFilter)}
    >
      <SelectTrigger className="h-7 text-xs w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableOptions.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-xs"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
