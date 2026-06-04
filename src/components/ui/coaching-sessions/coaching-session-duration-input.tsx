"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/components/lib/utils";
import { DURATION_PRESETS } from "@/types/coaching-session-duration";

export interface CoachingSessionDurationInputProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  id?: string;
  error?: string;
}

export function CoachingSessionDurationInput({
  value,
  onChange,
  disabled,
  id,
  error,
}: CoachingSessionDurationInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef(value);

  // Mirror externally-driven value changes (default load, reset, preset) into
  // the draft, without clobbering an in-progress edit such as a cleared field.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setDraft(String(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = (next: number) => {
    lastEmitted.current = next;
    onChange(next);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value);
    const next = parseInt(e.target.value, 10);
    emit(Number.isNaN(next) ? 0 : next);
  };

  const handlePresetSelect = (minutes: number) => {
    setDraft(String(minutes));
    emit(minutes);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <>
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Duration in minutes"
          value={draft}
          onChange={handleInputChange}
          disabled={disabled}
          className="pr-9"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              aria-label="Show duration presets"
              className="absolute inset-y-0 right-0 flex items-center justify-center w-9 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-40 p-1">
            <ul role="listbox" aria-label="Duration presets">
              {DURATION_PRESETS.map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === m}
                    onClick={() => handlePresetSelect(m)}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent",
                      value === m && "bg-accent/50 font-medium"
                    )}
                  >
                    {m} minutes
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
