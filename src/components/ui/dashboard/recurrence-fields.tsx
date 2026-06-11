"use client";

import { DateTime } from "ts-luxon";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/components/lib/utils";
import {
  Frequency,
  MAX_INTERVAL,
  MAX_OCCURRENCES,
  RecurrenceEnd,
  WEEKDAYS_ORDERED,
  Weekday,
  frequencyLabel,
  frequencySupportsWeekdays,
  weekdayLabel,
} from "@/types/recurrence";

export interface RecurrenceFieldsProps {
  frequency: Frequency;
  onFrequencyChange: (frequency: Frequency) => void;
  interval: number;
  onIntervalChange: (interval: number) => void;
  byWeekdays: Weekday[];
  onByWeekdaysChange: (weekdays: Weekday[]) => void;
  end: RecurrenceEnd;
  onEndChange: (end: RecurrenceEnd) => void;
  startWeekday: Weekday | null;
  startDate: DateTime | null;
  timezone: string;
  disabled?: boolean;
  error?: string | null;
}

export function RecurrenceFields({
  frequency,
  onFrequencyChange,
  interval,
  onIntervalChange,
  byWeekdays,
  onByWeekdaysChange,
  end,
  onEndChange,
  startWeekday,
  startDate,
  timezone,
  disabled = false,
  error = null,
}: RecurrenceFieldsProps) {
  const defaultUntilDate = (): string => {
    const anchor = startDate ?? DateTime.now().setZone(timezone);
    return anchor.plus({ weeks: 4 }).toFormat("yyyy-MM-dd");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="recurrence-frequency">Frequency</Label>
          <Select
            value={frequency}
            onValueChange={(v) => onFrequencyChange(v as Frequency)}
            disabled={disabled}
          >
            <SelectTrigger id="recurrence-frequency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(Frequency).map((f) => (
                <SelectItem key={f} value={f}>
                  {frequencyLabel(f)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="recurrence-interval">Every</Label>
          <Input
            id="recurrence-interval"
            type="number"
            min={1}
            max={MAX_INTERVAL}
            value={interval}
            onChange={(e) => {
              const next = parseInt(e.target.value, 10);
              onIntervalChange(Number.isFinite(next) && next >= 1 ? next : 1);
            }}
            disabled={disabled}
          />
        </div>
      </div>

      {frequencySupportsWeekdays(frequency) && (
        <div className="space-y-2">
          <Label>On these days</Label>
          <ToggleGroup
            type="multiple"
            value={byWeekdays}
            onValueChange={(v) => onByWeekdaysChange(v as Weekday[])}
            disabled={disabled}
            className="justify-start flex-wrap"
          >
            {WEEKDAYS_ORDERED.map((d) => (
              <ToggleGroupItem
                key={d}
                value={d}
                aria-label={weekdayLabel(d)}
                className="w-10"
              >
                {weekdayLabel(d).slice(0, 1)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {startWeekday && (
            <p className="text-xs text-muted-foreground">
              Your first session is on a {weekdayLabel(startWeekday)}, which
              must stay selected.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>Ends</Label>
        <RadioGroup
          value={end.kind}
          onValueChange={(v) =>
            onEndChange(
              v === "count"
                ? { kind: "count", count: end.kind === "count" ? end.count : 4 }
                : {
                    kind: "until",
                    until:
                      end.kind === "until" && end.until
                        ? end.until
                        : defaultUntilDate(),
                  }
            )
          }
          disabled={disabled}
        >
          <div className="flex items-center gap-3">
            <RadioGroupItem id="end-count" value="count" />
            <Label htmlFor="end-count" className="cursor-pointer">
              After
            </Label>
            <Input
              type="number"
              min={1}
              max={MAX_OCCURRENCES}
              value={end.kind === "count" ? end.count : ""}
              onChange={(e) => {
                const next = parseInt(e.target.value, 10);
                onEndChange({
                  kind: "count",
                  count: Number.isFinite(next) && next >= 1 ? next : 1,
                });
              }}
              disabled={disabled || end.kind !== "count"}
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">occurrences</span>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem id="end-until" value="until" />
            <Label htmlFor="end-until" className="cursor-pointer">
              On
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || end.kind !== "until"}
                  className={cn(
                    "h-9 gap-2 font-normal",
                    end.kind === "until" && end.until
                      ? ""
                      : "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="h-4 w-4" />
                  {end.kind === "until" && end.until
                    ? DateTime.fromISO(end.until).toLocaleString(
                        DateTime.DATE_MED
                      )
                    : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={
                    end.kind === "until" && end.until
                      ? new Date(`${end.until}T00:00:00`)
                      : undefined
                  }
                  onSelect={(date) =>
                    onEndChange({
                      kind: "until",
                      until: date
                        ? DateTime.fromJSDate(date).toFormat("yyyy-MM-dd")
                        : "",
                    })
                  }
                />
              </PopoverContent>
            </Popover>
          </div>
        </RadioGroup>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
