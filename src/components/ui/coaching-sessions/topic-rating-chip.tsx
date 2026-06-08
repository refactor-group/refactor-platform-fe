"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, Clock, Star, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/components/lib/utils";
import { TopicImmediacy, TopicRelevance } from "@/types/coaching-session-topic";

type Axis = "relevance" | "immediacy";
type TopicRating = TopicRelevance | TopicImmediacy;

interface AxisConfig {
  icon: LucideIcon;
  name: string;
  subtitle: string;
  neutral: TopicRating;
  // Ordered non-neutral levels (1 → 3) paired with their display labels.
  levels: { value: TopicRating; label: string }[];
  // Chip tint deepens with the level (color-intensity scan).
  chip: Record<number, string>;
  dot: Record<number, string>;
}

const AXIS_CONFIG: Record<Axis, AxisConfig> = {
  relevance: {
    icon: Star,
    name: "Relevance",
    subtitle: "How relevant is this topic to you today?",
    neutral: TopicRelevance.Neutral,
    levels: [
      { value: TopicRelevance.Peripheral, label: "Peripheral" },
      { value: TopicRelevance.WorthExploring, label: "Worth exploring" },
      { value: TopicRelevance.Central, label: "Central" },
    ],
    chip: {
      1: "border-indigo-500/30 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300",
      2: "border-indigo-500/45 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
      3: "border-indigo-500/70 bg-indigo-500/20 text-indigo-800 dark:text-indigo-200",
    },
    dot: {
      1: "bg-indigo-500/40",
      2: "bg-indigo-500/70",
      3: "bg-indigo-500",
    },
  },
  immediacy: {
    icon: Clock,
    name: "Immediacy",
    subtitle: "How soon does this topic need our attention?",
    neutral: TopicImmediacy.Neutral,
    levels: [
      { value: TopicImmediacy.CanWait, label: "Can wait" },
      { value: TopicImmediacy.Soon, label: "Soon" },
      { value: TopicImmediacy.Pressing, label: "Pressing" },
    ],
    chip: {
      1: "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
      2: "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      3: "border-amber-500/70 bg-amber-500/20 text-amber-800 dark:text-amber-200",
    },
    dot: {
      1: "bg-amber-500/40",
      2: "bg-amber-500/70",
      3: "bg-amber-500",
    },
  },
};

export interface TopicRatingChipProps {
  axis: Axis;
  value: TopicRelevance | TopicImmediacy;
  editable: boolean;
  onChange: (next: TopicRelevance | TopicImmediacy) => void;
}

export function TopicRatingChip({
  axis,
  value,
  editable,
  onChange,
}: TopicRatingChipProps) {
  const config = AXIS_CONFIG[axis];
  const Icon = config.icon;
  const [open, setOpen] = useState(false);

  const levelIndex = config.levels.findIndex((l) => l.value === value);
  const isSet = levelIndex >= 0;
  const level = levelIndex + 1;
  const currentLabel = isSet ? config.levels[levelIndex].label : "Unrated";
  const ariaLabel = `${config.name}: ${currentLabel}`;

  // Collapsed = a colored icon. Click expands it (reveals the level word) and
  // opens the popover — a chooser for the coachee, read-only for the coach.
  const chipClass = cn(
    "inline-flex h-6 cursor-pointer items-center overflow-hidden rounded-full border transition-colors hover:border-foreground/40",
    isSet
      ? config.chip[level]
      : "border-dashed border-border bg-transparent text-muted-foreground/60"
  );
  const labelClass = cn(
    "overflow-hidden whitespace-nowrap text-[11px] transition-all duration-200 ease-out",
    open ? "max-w-[7rem] pr-2.5 opacity-100" : "max-w-0 opacity-0"
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={chipClass} aria-label={ariaLabel}>
          <span className="grid h-6 w-6 shrink-0 place-items-center">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className={labelClass}>{isSet ? currentLabel : config.name}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-2 pt-1.5 pb-1">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Icon className="h-3 w-3" />
            {config.name}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">
            {config.subtitle}
          </p>
        </div>
        {editable ? (
          config.levels.map(({ value: levelValue, label }, i) => {
            const selected = levelValue === value;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onChange(selected ? config.neutral : levelValue);
                  setOpen(false);
                }}
                title={selected ? "Click to clear" : undefined}
                className={cn(
                  "group/opt flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                  selected && "font-medium"
                )}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className={cn("h-2 w-2 rounded-full", config.dot[i + 1])}
                  />
                  {label}
                </span>
                {selected && (
                  <>
                    <Check className="h-3.5 w-3.5 text-muted-foreground group-hover/opt:hidden" />
                    <X className="hidden h-3.5 w-3.5 text-muted-foreground group-hover/opt:block" />
                  </>
                )}
              </button>
            );
          })
        ) : (
          <div className="px-2 pb-1.5">
            <p className="text-sm">{currentLabel}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground/60">
              Set by the coachee
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export interface TopicRatingsProps {
  relevance: TopicRelevance;
  immediacy: TopicImmediacy;
  editable: boolean;
  onRelevance: (v: TopicRelevance) => void;
  onImmediacy: (v: TopicImmediacy) => void;
}

export function TopicRatings({
  relevance,
  immediacy,
  editable,
  onRelevance,
  onImmediacy,
}: TopicRatingsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <TopicRatingChip
        axis="relevance"
        value={relevance}
        editable={editable}
        onChange={(v) => onRelevance(v as TopicRelevance)}
      />
      <TopicRatingChip
        axis="immediacy"
        value={immediacy}
        editable={editable}
        onChange={(v) => onImmediacy(v as TopicImmediacy)}
      />
    </div>
  );
}
