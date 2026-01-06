"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/components/hooks/use-mobile";
import { AssignedActionsFilter } from "@/types/assigned-actions";

interface WhatsDueFilterProps {
  value: AssignedActionsFilter;
  onChange: (value: AssignedActionsFilter) => void;
}

const filterOptions = [
  {
    value: AssignedActionsFilter.DueSoon,
    label: "Due Soon",
    description: "Actions due before the next session",
  },
  {
    value: AssignedActionsFilter.AllIncomplete,
    label: "Incomplete",
    description: "All incomplete actions assigned to you",
  },
  {
    value: AssignedActionsFilter.AllUnassigned,
    label: "Unassigned",
    description: "Actions with no assignee",
  },
  {
    value: AssignedActionsFilter.Completed,
    label: "Completed",
    description: "Actions completed since last session",
  },
];

export function WhatsDueFilter({ value, onChange }: WhatsDueFilterProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
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
      {filterOptions.map((option, index) => {
        const isFirst = index === 0;
        const isLast = index === filterOptions.length - 1;

        let className = "whitespace-nowrap text-xs px-2 h-7";
        if (isFirst) {
          className += " rounded-r-none border-r-0";
        } else if (isLast) {
          className += " rounded-l-none";
        } else {
          className += " rounded-none border-r-0";
        }

        return (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className={className}
            title={option.description}
          >
            {option.label}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
