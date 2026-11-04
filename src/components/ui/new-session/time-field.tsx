"use client";

import type { DateTime } from "ts-luxon";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { timeOfDay } from "@/lib/session-window";
import type { Option } from "@/types/option";

interface TimeFieldProps {
  suggestions: DateTime[];
  /** "HH:mm". */
  value: Option<string>;
  onChange: (time: string) => void;
}

const asValue = (time: DateTime): string => time.toFormat("HH:mm");

export function TimeField({ suggestions, value, onChange }: TimeFieldProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-label font-medium text-muted-foreground">Time</span>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
          {suggestions.map((time) => (
            <Chip
              key={time.toMillis()}
              size="md"
              selected={value.some && value.val === asValue(time)}
              onClick={() => onChange(asValue(time))}
              className="tabular-nums"
            >
              {timeOfDay(time)}
            </Chip>
          ))}
        </div>
      )}
      <Input
        type="time"
        aria-label="Start time"
        value={value.some ? value.val : ""}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        className="h-11 tabular-nums modal:h-9"
      />
    </div>
  );
}
