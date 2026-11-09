"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Chip } from "@/components/ui/chip";
import { durationText } from "@/lib/scheduling-copy";
import {
  DURATION_CHIPS,
  DURATION_FIELD_MAX,
  DURATION_FIELD_MIN,
  DURATION_FIELD_STEP,
  clampDuration,
  matchingChip,
  stepDuration,
} from "@/types/coaching-session-duration";

interface DurationFieldProps {
  /** Minutes. */
  value: number;
  onChange: (minutes: number) => void;
}

const STEP_BUTTON_CLASSES =
  "inline-flex h-11 w-11 items-center justify-center text-ink-2 transition-colors duration-150 hover:bg-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:text-disabled-icon modal:h-9 modal:w-9 motion-reduce:transition-none";

function DurationChips({ value, onChange }: DurationFieldProps) {
  const chip = matchingChip(value);
  return (
    <>
      {DURATION_CHIPS.map((minutes) => (
        <Chip
          key={minutes}
          size="md"
          selected={chip.some && chip.val === minutes}
          onClick={() => onChange(minutes)}
          className="tabular-nums"
        >
          {durationText(minutes)}
        </Chip>
      ))}
    </>
  );
}

function DurationStepper({ value, onChange }: DurationFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);

  // Reset the draft during render when the value changes from outside.
  if (value !== shown) {
    setShown(value);
    setDraft(String(value));
  }

  const commit = () => {
    const typed = parseInt(draft, 10);
    // A cleared or non-numeric box keeps the duration it had.
    if (Number.isNaN(typed)) {
      setDraft(String(value));
      return;
    }
    const next = clampDuration(typed);
    setDraft(String(next));
    onChange(next);
  };

  return (
    <div className="ml-2.5 inline-flex h-11 items-center overflow-hidden rounded-full border bg-card modal:h-9">
      <button
        type="button"
        aria-label="Decrease duration"
        disabled={value <= DURATION_FIELD_MIN}
        onClick={() => onChange(stepDuration(value, -1))}
        className={STEP_BUTTON_CLASSES}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={DURATION_FIELD_MIN}
        max={DURATION_FIELD_MAX}
        step={DURATION_FIELD_STEP}
        aria-label="Duration in minutes"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
        className={cn(
          "h-11 w-11 border-0 bg-transparent text-center text-[13px] font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring modal:h-9",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        )}
      />
      <span className="pr-1 text-[13px] text-muted-foreground">min</span>
      <button
        type="button"
        aria-label="Increase duration"
        disabled={value >= DURATION_FIELD_MAX}
        onClick={() => onChange(stepDuration(value, 1))}
        className={STEP_BUTTON_CLASSES}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function DurationField({ value, onChange }: DurationFieldProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-label font-medium text-muted-foreground">Duration</span>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
        <DurationChips value={value} onChange={onChange} />
        <DurationStepper value={value} onChange={onChange} />
      </div>
    </div>
  );
}
