"use client";

import { Info } from "ts-luxon";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WEEKDAYS_ORDERED, type Weekday } from "@/types/recurrence";

interface WeekdayPickerProps {
  value: Weekday[];
  /** The start weekday; always kept. */
  locked: Weekday;
  onChange: (days: Weekday[]) => void;
}

const LONG_NAMES = Info.weekdays("long");

export function WeekdayPicker({ value, locked, onChange }: WeekdayPickerProps) {
  const handleChange = (next: string[]) => {
    if (!next.includes(locked)) return;
    onChange(WEEKDAYS_ORDERED.filter((day) => next.includes(day)));
  };

  return (
    <ToggleGroup
      type="multiple"
      variant="round"
      size={null}
      value={value}
      onValueChange={handleChange}
      className="flex-wrap justify-start gap-1 modal:gap-1.5"
    >
      {WEEKDAYS_ORDERED.map((day, index) => (
        <ToggleGroupItem
          key={day}
          value={day}
          aria-label={LONG_NAMES[index]}
          className="h-11 w-11 text-[13px] modal:h-10 modal:w-10"
        >
          {LONG_NAMES[index].slice(0, 1)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
