import type { DateTime } from "ts-luxon";
import { timeOfDay } from "@/lib/session-window";
import type { CardView } from "@/lib/week-grid/card";
import type { Option } from "@/types/option";

export interface DragGhostProps {
  view: CardView;
  hovered: Option<DateTime>;
}

export function DragGhost({ view, hovered }: DragGhostProps) {
  return (
    <div className="flex w-[120px] -rotate-2 cursor-grabbing flex-col gap-1 rounded-xl bg-card px-3 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,.22)]">
      <span className="text-xs tabular-nums text-muted-foreground">
        {timeOfDay(hovered.some ? hovered.val : view.start)}
      </span>
      <span className="truncate text-[13px] font-semibold text-foreground">{view.name}</span>
    </div>
  );
}
