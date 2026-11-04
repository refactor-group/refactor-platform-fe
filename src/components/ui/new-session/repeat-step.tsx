"use client";

import { useId } from "react";
import { cn } from "@/components/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { WeekdayPicker } from "@/components/ui/new-session/weekday-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { type RepeatModel, STANDARD_CADENCES, sameCadence } from "@/lib/new-session-dialog-model";
import type { Cadence } from "@/lib/scheduling";
import { cadenceLabel } from "@/lib/scheduling-copy";
import { type Option, None, Some } from "@/types/option";
import { type RecurrenceEnd, frequencySupportsWeekdays } from "@/types/recurrence";

interface RepeatOption {
  label: string;
  cadence: Option<Cadence>;
}

function repeatOptions({ optional, seriesCadence }: RepeatModel): RepeatOption[] {
  const none: RepeatOption[] = optional ? [{ label: "Doesn't repeat", cadence: None }] : [];
  const series: RepeatOption[] = seriesCadence.some
    ? [{ label: cadenceLabel(seriesCadence.val), cadence: seriesCadence }]
    : [];
  const standard = STANDARD_CADENCES.map((cadence) => ({ label: cadenceLabel(cadence), cadence: Some(cadence) }));
  return [...none, ...series, ...standard];
}

const FIELD_CLASSES = "h-11 tabular-nums modal:h-9";
// A 44px tap box below 900px with the 16px circle drawn inside it.
const RADIO_CLASSES =
  "relative -ml-3.5 -mr-2.5 h-11 w-11 shrink-0 border-0 before:absolute before:left-1/2 before:top-1/2 before:h-4 before:w-4 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-primary modal:ml-0 modal:mr-0 modal:h-4 modal:w-4";
const LABEL_CLASSES = "flex h-11 items-center pr-1 text-sm modal:h-auto";

function isChosen({ repeat }: RepeatModel, cadence: Option<Cadence>): boolean {
  if (cadence.none) return repeat.kind === "none";
  return repeat.kind === "repeat" && sameCadence(repeat, cadence.val);
}

function SectionLabel({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="text-label font-medium text-muted-foreground">
      {children}
    </p>
  );
}

function FrequencyChips(model: RepeatModel) {
  return (
    <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
      {repeatOptions(model).map((option) => (
        <Chip
          key={option.label}
          size="md"
          selected={isChosen(model, option.cadence)}
          onClick={() => model.onRepeatChange(option.cadence)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

interface EndFieldsProps {
  labelledBy: string;
  end: RecurrenceEnd;
  defaultEnd: RepeatModel["defaultEnd"];
  onEndChange: (end: RecurrenceEnd) => void;
}

function EndFields({ labelledBy, end, defaultEnd, onEndChange }: EndFieldsProps) {
  const id = useId();
  const count = end.kind === "count" ? end.count : defaultEnd.count;
  const until = end.kind === "until" ? end.until : defaultEnd.until;
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={end.kind}
      onValueChange={(kind) =>
        onEndChange(kind === "until" ? { kind: "until", until } : { kind: "count", count })
      }
      className="gap-1"
    >
      <div className="flex h-11 items-center gap-2.5 modal:h-10">
        <RadioGroupItem id={`${id}-count`} value="count" className={RADIO_CLASSES} />
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
        <RadioGroupItem id={`${id}-until`} value="until" className={RADIO_CLASSES} />
        <label htmlFor={`${id}-until`} className={LABEL_CLASSES}>
          On
        </label>
        <Input
          type="date"
          aria-label="End date"
          value={until}
          onChange={(event) => onEndChange({ kind: "until", until: event.target.value })}
          className={cn(FIELD_CLASSES, "w-auto")}
        />
      </div>
    </RadioGroup>
  );
}

export function RepeatStep(model: RepeatModel) {
  const { repeat, error } = model;
  const id = useId();
  return (
    <fieldset disabled={model.locked} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
      <FrequencyChips {...model} />
      {repeat.kind === "repeat" && frequencySupportsWeekdays(repeat.frequency) && (
        <div className="flex flex-col gap-2.5">
          <SectionLabel id={`${id}-days`}>On these days</SectionLabel>
          <WeekdayPicker
            labelledBy={`${id}-days`}
            value={model.byWeekdays}
            locked={model.lockedWeekday}
            onChange={model.onWeekdaysChange}
          />
        </div>
      )}
      {repeat.kind === "repeat" && (
        <div className="flex flex-col gap-2.5">
          <SectionLabel id={`${id}-ends`}>Ends</SectionLabel>
          <EndFields labelledBy={`${id}-ends`} end={repeat.end} defaultEnd={model.defaultEnd} onEndChange={model.onEndChange} />
          {error.some && (
            <p role="alert" className="text-xs text-destructive">
              {error.val}
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
