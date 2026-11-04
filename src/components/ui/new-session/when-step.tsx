"use client";

import { BusyNote } from "@/components/ui/new-session/busy-note";
import { DurationField } from "@/components/ui/new-session/duration-field";
import { MonthGrid } from "@/components/ui/new-session/month-grid";
import { TimeField } from "@/components/ui/new-session/time-field";
import type { WhenModel } from "@/lib/hooks/use-new-session-dialog";

export function WhenStep(props: WhenModel) {
  const { day, clash, onTimeChange } = props;
  return (
    <div className="grid grid-cols-1 gap-7 modal:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex flex-col gap-4">
        <MonthGrid
          month={props.month}
          today={props.today}
          selected={day}
          busy={props.busy}
          tooltips={props.tooltips}
          onSelect={props.onSelectDay}
          onMonthChange={props.onMonthChange}
        />
        {day.some && (
          <BusyNote
            day={day.val}
            sessions={props.dayBusy}
            clash={clash}
            onUseInstead={(start) => onTimeChange(start.toFormat("HH:mm"))}
          />
        )}
      </div>
      <div className="flex flex-col gap-6">
        <TimeField suggestions={props.suggestions} value={props.time} onChange={onTimeChange} />
        <DurationField value={props.minutes} onChange={props.onMinutesChange} />
      </div>
    </div>
  );
}
