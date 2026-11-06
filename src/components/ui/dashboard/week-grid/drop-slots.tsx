import { useDroppable } from "@dnd-kit/core";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { timeOfDay } from "@/lib/session-window";
import { dropOutcome, type DaySlot, type DropTarget, type SlotState } from "@/lib/week-grid/slots";
import { type Option, None, Some } from "@/types/option";

export interface DropSlotsProps {
  slots: DaySlot[];
  hovered: Option<DateTime>;
  /** The dragged session's person, shown on its current slot. */
  name: string;
}

export function DropSlots({ slots, hovered, name }: DropSlotsProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {slots.map((slot) => (
        <DropSlot
          key={slot.start.toMillis()}
          slot={slot}
          hovered={hovered.some && hovered.val.equals(slot.start)}
          name={name}
        />
      ))}
    </div>
  );
}

interface DropSlotProps {
  slot: DaySlot;
  hovered: boolean;
  name: string;
}

function DropSlot({ slot, hovered, name }: DropSlotProps) {
  const { setNodeRef } = useDroppable({
    id: `slot:${slot.start.toISO()}`,
    data: { kind: "slot", slot } satisfies DropTarget,
    disabled: dropOutcome(slot).kind === "ignore",
  });
  const look = slotLook(slot.state, name);
  return (
    <div
      ref={setNodeRef}
      data-testid={`drop-slot-${slot.start.toFormat("yyyy-MM-dd-HH:mm")}`}
      data-state={slot.state.kind}
      className={cn(
        "flex h-[22px] items-center gap-1.5 rounded-[6px] border px-2 text-tiny font-medium tabular-nums",
        hovered ? "border-inverse bg-inverse text-inverse-foreground" : look.className
      )}
    >
      {timeOfDay(slot.start)}
      {look.note.some && (
        <span className={cn("truncate text-[10.5px]", hovered ? "opacity-70" : "text-faint")}>{look.note.val}</span>
      )}
    </div>
  );
}

interface SlotLook {
  className: string;
  note: Option<string>;
}

function slotLook(state: SlotState, name: string): SlotLook {
  switch (state.kind) {
    case "free":
      return { className: "border-hairline bg-card text-ink-2", note: None };
    case "taken":
      return { className: "border-transparent bg-fill text-ink-2", note: Some(state.holder) };
    case "current":
      return {
        className: "border-dashed border-brand bg-brand-tint text-brand-strong",
        note: Some(`${name} · current`),
      };
    case "past":
      return { className: "border-transparent text-faint", note: None };
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled slot state: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
