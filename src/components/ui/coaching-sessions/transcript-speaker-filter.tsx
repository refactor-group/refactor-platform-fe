"use client";

import { cn } from "@/components/lib/utils";

/**
 * A single selectable option in the speaker-filter segmented control.
 * Options without a `swatchClass` (typically the "All" option) render
 * without a color dot.
 */
export interface SpeakerFilterOption {
  /** Opaque value passed back to `onChange` (e.g. `"all"` or a raw `speaker_label`). */
  value: string;
  /** Display text. */
  label: string;
  /** Optional Tailwind background class for the color swatch. */
  swatchClass?: string;
}

interface TranscriptSpeakerFilterProps {
  options: readonly SpeakerFilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** Optional accessible label override (default: "Filter transcript by speaker"). */
  ariaLabel?: string;
}

/**
 * Segmented control for filtering the visible transcript to a single
 * speaker (or showing all). Radio-style semantics: clicking an option
 * becomes the active selection; clicking the already-active option is
 * a no-op (unlike toggleable chips).
 */
export function TranscriptSpeakerFilter({
  options,
  value,
  onChange,
  ariaLabel = "Filter transcript by speaker",
}: TranscriptSpeakerFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/70 w-fit"
    >
      {options.map((option) => (
        <SpeakerSegment
          key={option.value}
          option={option}
          active={option.value === value}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  );
}

interface SpeakerSegmentProps {
  option: SpeakerFilterOption;
  active: boolean;
  onClick: () => void;
}

function SpeakerSegment({ option, active, onClick }: SpeakerSegmentProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {option.swatchClass && (
        <span
          aria-hidden="true"
          className={cn("h-2 w-2 rounded-sm", option.swatchClass)}
        />
      )}
      {option.label}
    </button>
  );
}
