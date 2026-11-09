"use client";

import { useState } from "react";
import type { DateTime } from "ts-luxon";
import { Button } from "@/components/ui/button";
import { DayCircle } from "@/components/ui/day-circle";
import { BusyNote } from "@/components/ui/new-session/busy-note";
import { TimeField } from "@/components/ui/new-session/time-field";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { MoveChoices } from "@/lib/week-grid/move-choices";
import { type Option, None, Some } from "@/types/option";

export interface MoveSheetModel extends MoveChoices {
  name: string;
  current: DateTime;
  now: DateTime;
  days: { day: DateTime; past: boolean }[];
}

export interface MoveSheetProps {
  model: Option<MoveSheetModel>;
  onConfirm: (start: DateTime) => void;
  onResolve: (start: DateTime) => void;
  onClose: () => void;
}

export function MoveSheet({ model, onConfirm, onResolve, onClose }: MoveSheetProps) {
  const { shown, openCount } = useShownModel(model);
  return (
    <Sheet open={model.some} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-card p-0"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />
        {shown.some && <MoveSheetBody key={openCount} model={shown.val} onConfirm={onConfirm} onResolve={onResolve} />}
      </SheetContent>
    </Sheet>
  );
}

// Keeps the last model through the closing slide; each open starts fresh.
function useShownModel(model: Option<MoveSheetModel>) {
  const [shown, setShown] = useState(model);
  const [wasOpen, setWasOpen] = useState(model.some);
  const [openCount, setOpenCount] = useState(0);
  if (model.some !== wasOpen) {
    setWasOpen(model.some);
    if (model.some) setOpenCount((n) => n + 1);
  }
  if (model.some && model !== shown) setShown(model);
  return { shown, openCount };
}

interface MoveSheetBodyProps {
  model: MoveSheetModel;
  onConfirm: (start: DateTime) => void;
  onResolve: (start: DateTime) => void;
}

const asTime = (start: DateTime): string => start.toFormat("HH:mm");

function startAt(day: DateTime, time: string): DateTime {
  const [hour, minute] = time.split(":").map(Number);
  return day.set({ hour, minute });
}

function MoveSheetBody({ model, onConfirm, onResolve }: MoveSheetBodyProps) {
  const { name, current, days, suggestionsFor, busyOn, clashAt } = model;
  const [day, setDay] = useState(current.startOf("day"));
  const [time, setTime] = useState<Option<string>>(Some(asTime(current)));
  const start = time.some ? Some(startAt(day, time.val)) : None;
  const clash = start.some ? clashAt(start.val) : None;
  // A time belongs to the shown day; a new day starts over without one.
  const showDay = (next: DateTime) => {
    setDay(next);
    setTime(None);
  };
  return (
    <>
      <SheetTitle className="shrink-0 px-5 pb-1 pt-3 text-base">Move {name}&apos;s session</SheetTitle>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-7 justify-items-center gap-1">
          {days.map((d) => (
            <DayCircle
              key={d.day.toMillis()}
              day={d.day}
              past={d.past}
              selected={d.day.hasSame(day, "day")}
              onSelect={showDay}
              className="h-11 w-11"
            />
          ))}
        </div>
        <BusyNote
          day={day}
          sessions={busyOn(day)}
          clash={clash}
          onUseInstead={(instead) => setTime(Some(asTime(instead)))}
        />
        <TimeField suggestions={suggestionsFor(day)} value={time} onChange={(t) => setTime(Some(t))} />
      </div>
      <div className="shrink-0 border-t px-5 py-4">
        <MoveSheetAction model={model} start={start} clash={clash.some} onConfirm={onConfirm} onResolve={onResolve} />
      </div>
    </>
  );
}

interface MoveSheetActionProps {
  model: MoveSheetModel;
  start: Option<DateTime>;
  clash: boolean;
  onConfirm: (start: DateTime) => void;
  onResolve: (start: DateTime) => void;
}

function MoveSheetAction({ model, start, clash, onConfirm, onResolve }: MoveSheetActionProps) {
  const ahead = start.some && start.val >= model.now;
  if (start.some && ahead && clash) {
    return (
      <Button className="w-full" onClick={() => onResolve(start.val)}>
        Resolve overlap…
      </Button>
    );
  }
  const canMove = start.some && ahead && start.val.toMillis() !== model.current.toMillis();
  return (
    <Button className="w-full" disabled={!canMove} onClick={() => start.some && onConfirm(start.val)}>
      Move session
    </Button>
  );
}
