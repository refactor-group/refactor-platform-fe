"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignedActionsFilter } from "@/types/assigned-actions";

interface WhatsDueFilterProps {
  value: AssignedActionsFilter;
  onChange: (value: AssignedActionsFilter) => void;
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

export function WhatsDueFilter({ value, onChange }: WhatsDueFilterProps) {
  return (
    <Select
      value={value}
      onValueChange={(newValue) => onChange(newValue as AssignedActionsFilter)}
    >
      <SelectTrigger className="h-7 text-xs w-[120px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {filterOptions.map((option) => (
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
