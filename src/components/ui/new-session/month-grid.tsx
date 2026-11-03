"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateTime, Info } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { useHoverIntent } from "@/lib/hooks/use-hover-intent";
import { type BusySession, busyOn } from "@/lib/scheduling";
import { busyRange, sessionCount, shortDay } from "@/lib/scheduling-copy";
import { formatWeekdayDate } from "@/lib/utils/date";
import { type Option, None } from "@/types/option";

interface MonthGridProps {
  month: DateTime;
  today: DateTime;
  selected: Option<DateTime>;
  busy: BusySession[];
  tooltips: boolean;
  onSelect: (day: DateTime) => void;
  onMonthChange: (month: DateTime) => void;
}

const TOOLTIP_DELAY_MS = 350;
const WEEKDAY_LETTERS = Info.weekdays("narrow");

const ARROW_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

interface GridDay {
  date: DateTime;
  sessions: BusySession[];
  past: boolean;
  isToday: boolean;
  isSelected: boolean;
}

function gridDays(props: MonthGridProps): GridDay[] {
  const { month, today, selected, busy } = props;
  const first = month.startOf("month");
  const todayStart = today.startOf("day");
  return Array.from({ length: first.daysInMonth }, (_, index) => {
    const date = first.plus({ days: index });
    return {
      date,
      sessions: busyOn(busy, date, None),
      past: date < todayStart,
      isToday: date.hasSame(today, "day"),
      isSelected: selected.some && selected.val.hasSame(date, "day"),
    };
  });
}

/** Index of the one day reachable by Tab: selected, else today, else the first enabled day. */
function tabStopIndex(days: GridDay[]): number {
  const enabled = (d: GridDay) => !d.past;
  const selected = days.findIndex((d) => d.isSelected && enabled(d));
  if (selected >= 0) return selected;
  const today = days.findIndex((d) => d.isToday);
  if (today >= 0) return today;
  return days.findIndex(enabled);
}

function dayKey(day: GridDay): string {
  return day.date.toFormat("yyyy-MM-dd");
}

function dayLabel(day: GridDay): string {
  const label = formatWeekdayDate(day.date);
  return day.sessions.length > 0 ? `${label}, ${sessionCount(day.sessions.length)}` : label;
}

interface MonthHeaderProps {
  month: DateTime;
  today: DateTime;
  onMonthChange: (month: DateTime) => void;
}

function MonthHeader({ month, today, onMonthChange }: MonthHeaderProps) {
  const start = month.startOf("month");
  return (
    <div className="flex h-11 items-center gap-1 modal:h-7">
      <span className="min-w-0 flex-1 truncate whitespace-nowrap text-item font-medium tabular-nums">
        {month.toFormat("LLL yyyy")}
      </span>
      {!month.hasSame(today, "month") && (
        <button
          type="button"
          onClick={() => onMonthChange(today.startOf("month"))}
          className="h-11 rounded-full bg-fill px-3 text-xs font-medium transition-colors duration-150 hover:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring modal:h-7 motion-reduce:transition-none"
        >
          Today
        </button>
      )}
      <Button
        variant="ghost"
        size="icon-md"
        aria-label="Previous month"
        onClick={() => onMonthChange(start.minus({ months: 1 }))}
        className="modal:h-7 modal:w-7"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-md"
        aria-label="Next month"
        onClick={() => onMonthChange(start.plus({ months: 1 }))}
        className="modal:h-7 modal:w-7"
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

function WeekdayHeader() {
  return (
    <div aria-hidden className="mt-2 grid grid-cols-7 text-center text-tiny text-muted-foreground">
      {WEEKDAY_LETTERS.map((letter, index) => (
        <span key={index}>{letter}</span>
      ))}
    </div>
  );
}

function DayTooltipContent({ day }: { day: GridDay }) {
  // Portaled with collision handling so the dialog body's scroll box can't clip it.
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        side="top"
        sideOffset={4}
        collisionPadding={8}
        className="pointer-events-none z-[60] whitespace-nowrap rounded-[10px] bg-inverse px-2.5 py-2 text-xs text-inverse-foreground shadow-popover animate-in fade-in-0 motion-reduce:animate-none"
      >
        <p className="text-tiny opacity-70 tabular-nums">{shortDay(day.date)}</p>
        {day.sessions.map((session) => (
          <p key={session.id} className="flex justify-between gap-4 tabular-nums">
            <span>{session.personName}</span>
            <span>{busyRange(session)}</span>
          </p>
        ))}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

function dayButtonClasses(day: GridDay): string {
  if (day.past) return "text-faint";
  if (day.isSelected) return "bg-primary text-primary-foreground";
  if (day.isToday) return "bg-brand-tint text-brand";
  return "text-foreground hover:bg-fill";
}

function busyDotClasses(day: GridDay): string {
  if (day.isSelected) return "bg-primary-foreground";
  return day.past ? "bg-brand-dot" : "bg-brand";
}

interface DayCellProps {
  day: GridDay;
  tabStop: boolean;
  tooltip: boolean;
  onSelect: (day: DateTime) => void;
  onHover: (hovering: boolean) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}

function DayCell({ day, tabStop, tooltip, onSelect, onHover, onKeyDown, buttonRef }: DayCellProps) {
  return (
    <div className="relative flex justify-center">
      {/* Hover intent alone opens it; Radix's own open requests are ignored. */}
      <TooltipPrimitive.Root open={tooltip} onOpenChange={() => {}}>
        <TooltipPrimitive.Trigger asChild>
          <button
            ref={buttonRef}
            type="button"
            aria-label={dayLabel(day)}
            aria-pressed={day.isSelected}
            aria-current={day.isToday ? "date" : undefined}
            disabled={day.past}
            tabIndex={tabStop ? 0 : -1}
            onClick={() => onSelect(day.date.startOf("day"))}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onKeyDown={onKeyDown}
            className={cn(
              "relative inline-flex aspect-square w-full max-w-11 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring modal:max-w-9 motion-reduce:transition-none",
              dayButtonClasses(day)
            )}
          >
            {day.date.day}
            {day.sessions.length > 0 && (
              <span
                aria-hidden
                className={cn("absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full", busyDotClasses(day))}
              />
            )}
          </button>
        </TooltipPrimitive.Trigger>
        {tooltip && <DayTooltipContent day={day} />}
      </TooltipPrimitive.Root>
    </div>
  );
}

export function MonthGrid(props: MonthGridProps) {
  const { month, today, tooltips, onSelect, onMonthChange } = props;
  const days = gridDays(props);
  const tabStop = tabStopIndex(days);
  const leadingBlanks = month.startOf("month").weekday - 1;
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const hover = useHoverIntent<string>(TOOLTIP_DELAY_MS);

  const moveFocus = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const step = ARROW_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const target = days[index + step];
    if (target && !target.past) buttons.current.get(index + step)?.focus();
  };

  const hoverDay = (day: GridDay, hovering: boolean) => {
    if (!hovering) hover.leave();
    else if (tooltips && day.sessions.length > 0) hover.enter(dayKey(day));
  };

  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <div>
        <MonthHeader month={month} today={today} onMonthChange={onMonthChange} />
        <WeekdayHeader />
        <div data-testid="month-grid-days" className="mt-1 grid grid-cols-7 gap-y-0.5">
          {Array.from({ length: leadingBlanks }, (_, index) => (
            <div key={`blank-${index}`} aria-hidden />
          ))}
          {days.map((day, index) => (
            <DayCell
              key={day.date.toMillis()}
              day={day}
              tabStop={index === tabStop}
              tooltip={hover.active.some && hover.active.val === dayKey(day)}
              onSelect={onSelect}
              onHover={(hovering) => hoverDay(day, hovering)}
              onKeyDown={(event) => moveFocus(index, event)}
              buttonRef={(node) => {
                if (node) buttons.current.set(index, node);
                else buttons.current.delete(index);
              }}
            />
          ))}
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
