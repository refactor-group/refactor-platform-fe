"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  DURATION_PRESETS,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
} from "@/types/coaching-session-duration";

const PRESETS_DATALIST_ID = "coaching-session-duration-presets";

export interface CoachingSessionDurationInputProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  id?: string;
  error?: string | null;
}

export function CoachingSessionDurationInput({
  value,
  onChange,
  disabled,
  id,
  error,
}: CoachingSessionDurationInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInt(e.target.value, 10);
    if (Number.isFinite(next)) {
      onChange(next);
    }
  };

  return (
    <>
      <Input
        id={id}
        type="number"
        list={PRESETS_DATALIST_ID}
        min={MIN_DURATION_MINUTES}
        max={MAX_DURATION_MINUTES}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Duration in minutes"
      />
      <datalist id={PRESETS_DATALIST_ID}>
        {DURATION_PRESETS.map((m) => (
          <option key={m} value={m}>
            {m} minutes
          </option>
        ))}
      </datalist>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
