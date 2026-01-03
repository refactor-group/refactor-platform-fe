"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CoachViewMode } from "@/types/assigned-actions";

interface WhatsDueCoachToggleProps {
  value: CoachViewMode;
  onChange: (value: CoachViewMode) => void;
}

export function WhatsDueCoachToggle({
  value,
  onChange,
}: WhatsDueCoachToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onChange(newValue as CoachViewMode);
      }}
      variant="outline"
      size="sm"
    >
      <ToggleGroupItem value={CoachViewMode.MyActions} className="whitespace-nowrap">
        My Actions
      </ToggleGroupItem>
      <ToggleGroupItem value={CoachViewMode.CoacheeActions} className="whitespace-nowrap">
        Coachee Actions
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
