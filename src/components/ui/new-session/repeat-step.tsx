"use client";

import { useId } from "react";
import { cn } from "@/components/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { WeekdayPicker } from "@/components/ui/new-session/weekday-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { RepeatModel } from "@/lib/new-session-dialog-model";
import { type Option, None, Some } from "@/types/option";
import { Frequency, type RecurrenceEnd, frequencySupportsWeekdays } from "@/types/recurrence";

const CHOICES: { label: string; frequency: Option<Frequency> }[] = [
  { label: "Doesn't repeat", frequency: None },
  { label: "Weekly", frequency: Some(Frequency.Weekly) },
  { label: "Every 2 weeks", frequency: Some(Frequency.Biweekly) },
  { label: "Monthly", frequency: Some(Frequency.Monthly) },
];

const FIELD_CLASSES = "h-11 tabular-nums modal:h-9";
const LABEL_CLASSES = "flex h-11 items-center pr-1 text-sm modal:h-auto";

function isChosen(model: RepeatModel, frequency: Option<Frequency>): boolean {
  const { repeat } = model;
  if (frequency.none) return repeat.kind === "none";
  return repeat.kind === "repeat" && repeat.frequency === frequency.val;
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-label font-medium text-muted-foreground">{children}</p>;
}

function FrequencyChips(model: RepeatModel) {
  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
      {CHOICES.filter((choice) => model.optional || choice.frequency.some).map((choice) => (
        <Chip
          key={choice.label}
          size="md"
          selected={isChosen(model, choice.frequency)}
          onClick={() => model.onRepeatChange(choice.frequency)}
        >
          {choice.label}
        </Chip>
      ))}
    </div>
  );
}

interface EndFieldsProps {
  end: RecurrenceEnd;
  defaultEnd: RepeatModel["defaultEnd"];
  onEndChange: (end: RecurrenceEnd) => void;
}

function EndFields({ end, defaultEnd, onEndChange }: EndFieldsProps) {
  const id = useId();
  const count = end.kind === "count" ? end.count : defaultEnd.count;
  const until = end.kind === "until" ? end.until : defaultEnd.until;
  return (
    <RadioGroup
      value={end.kind}
      onValueChange={(kind) =>
        onEndChange(kind === "until" ? { kind: "until", until } : { kind: "count", count })
      }
      className="gap-1"
    >
      <div className="flex h-11 items-center gap-2.5 modal:h-10">
        <RadioGroupItem id={`${id}-count`} value="count" />
        <label htmlFor={`${id}-count`} className={LABEL_CLASSES}>
          After
        </label>
        <Input
          type="number"
          min={1}
          aria-label="Number of sessions"
          value={Number.isNaN(count) ? "" : count}
          onChange={(event) => onEndChange({ kind: "count", count: parseInt(event.target.value, 10) })}
          className={cn(FIELD_CLASSES, "w-16")}
        />
        <span className="text-sm text-muted-foreground">sessions</span>
      </div>
      <div className="flex h-11 items-center gap-2.5 modal:h-10">
        <RadioGroupItem id={`${id}-until`} value="until" />
        <label htmlFor={`${id}-until`} className={LABEL_CLASSES}>
          On
        </label>
        <Input
          type="date"
          aria-label="End date"
          value={until}
          onChange={(event) => onEndChange({ kind: "until", until: event.target.value })}
          className={cn(FIELD_CLASSES, "w-40")}
        />
      </div>
    </RadioGroup>
  );
}

export function RepeatStep(model: RepeatModel) {
  const { repeat, error } = model;
  return (
    <div className="flex flex-col gap-6">
      <FrequencyChips {...model} />
      {repeat.kind === "repeat" && frequencySupportsWeekdays(repeat.frequency) && (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>On these days</SectionLabel>
          <WeekdayPicker value={model.byWeekdays} locked={model.lockedWeekday} onChange={model.onWeekdaysChange} />
        </div>
      )}
      {repeat.kind === "repeat" && (
        <div className="flex flex-col gap-2.5">
          <SectionLabel>Ends</SectionLabel>
          <EndFields end={repeat.end} defaultEnd={model.defaultEnd} onEndChange={model.onEndChange} />
          {error.some && (
            <p role="alert" className="text-xs text-destructive">
              {error.val}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
