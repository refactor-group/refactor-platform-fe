"use client";

import { useState } from "react";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DayCircle } from "@/components/ui/day-circle";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { timeOfDay } from "@/lib/session-window";
import type { DaySlot, SlotState } from "@/lib/week-grid/slots";
import { type Option, None, Some } from "@/types/option";

export interface MoveSheetModel {
  name: string;
  current: DateTime;
  days: { day: DateTime; past: boolean }[];
  slotsFor: (day: DateTime) => DaySlot[];
}

export interface MoveSheetProps {
  model: Option<MoveSheetModel>;
  onConfirm: (start: DateTime) => void;
  onClose: () => void;
}

export function MoveSheet({ model, onConfirm, onClose }: MoveSheetProps) {
  const { shown, openCount } = useShownModel(model);
  return (
    <Sheet open={model.some} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-card p-0"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border" />
        {shown.some && <MoveSheetBody key={openCount} model={shown.val} onConfirm={onConfirm} />}
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
}

function MoveSheetBody({ model, onConfirm }: MoveSheetBodyProps) {
  const { name, current, days, slotsFor } = model;
  const [day, setDay] = useState(current.startOf("day"));
  const [pick, setPick] = useState(current);
  const isPicked = (start: DateTime) => start.equals(pick);
  // A pick belongs to the shown day; a new day starts over from the current slot.
  const showDay = (next: DateTime) => {
    setDay(next);
    setPick(current);
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
        <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
          {slotsFor(day).map((slot) => (
            <SlotChip key={slot.start.toMillis()} slot={slot} picked={isPicked(slot.start)} onPick={setPick} />
          ))}
        </div>
      </div>
      <div className="shrink-0 border-t px-5 py-4">
        <Button className="w-full" disabled={pick.equals(current)} onClick={() => onConfirm(pick)}>
          Move session
        </Button>
      </div>
    </>
  );
}

interface SlotChipProps {
  slot: DaySlot;
  picked: boolean;
  onPick: (start: DateTime) => void;
}

function SlotChip({ slot, picked, onPick }: SlotChipProps) {
  const time = timeOfDay(slot.start);
  const look = slotLook(slot.state, time);
  return (
    <Chip
      size="md"
      selected={picked}
      aria-label={look.label}
      disabled={look.disabled}
      onClick={() => onPick(slot.start)}
      className={cn("tabular-nums", look.className)}
    >
      {time}
      {look.holder.some && <span className="ml-1.5 font-normal text-faint">{look.holder.val}</span>}
    </Chip>
  );
}

interface SlotLook {
  label: string;
  disabled: boolean;
  className: string;
  holder: Option<string>;
}

const CURRENT_SLOT_CLASS = "border border-dashed border-brand bg-brand-tint text-brand-strong hover:bg-brand-tint";

function slotLook(state: SlotState, time: string): SlotLook {
  const plain = { label: time, disabled: false, className: "", holder: None };
  switch (state.kind) {
    case "free":
      return plain;
    case "current":
      return { ...plain, label: `${time}, current`, className: CURRENT_SLOT_CLASS };
    case "taken":
      return { ...plain, label: `${time}, ${state.holder}`, disabled: true, holder: Some(state.holder) };
    case "past":
      return { ...plain, disabled: true };
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled slot state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
