"use client";

import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Chip } from "@/components/ui/chip";
import { DayCircle } from "@/components/ui/day-circle";
import type { ResolveModel } from "@/lib/new-session-dialog-model";
import { keptWord } from "@/lib/schedule-draft";
import { timeOfDay } from "@/lib/session-window";

function KeepBoth({ model }: { model: ResolveModel }) {
  const kept = model.resolution.kind === "keep";
  const label = `${model.movable ? "keep" : "Keep"} ${keptWord(model.several)} at ${timeOfDay(model.newStart)}`;
  return (
    <p className="text-[13px] text-muted-foreground">
      {model.movable && "Or "}
      <button
        type="button"
        aria-pressed={kept}
        onClick={model.onKeep}
        className={cn(
          "inline-flex h-11 items-center rounded-sm font-medium underline underline-offset-2 tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring modal:h-auto motion-reduce:transition-none",
          kept ? "text-brand" : "text-foreground hover:text-brand"
        )}
      >
        {label}
      </button>
    </p>
  );
}

function isMove(model: ResolveModel, start: DateTime): boolean {
  return model.resolution.kind === "move" && model.resolution.start.toMillis() === start.toMillis();
}

export function ResolveStep(model: ResolveModel) {
  return (
    <div className="flex flex-col gap-5">
      {model.movable && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {model.days.map(({ day, past }) => (
              <DayCircle
                key={day.toMillis()}
                day={day}
                past={past}
                selected={day.hasSame(model.selectedDay, "day")}
                onSelect={model.onSelectDay}
              />
            ))}
          </div>
          {model.slots.length > 0 && (
            <div className="flex flex-wrap gap-x-1.5 gap-y-2.5">
              {model.slots.map((start) => (
                <Chip
                  key={start.toMillis()}
                  size="md"
                  selected={isMove(model, start)}
                  onClick={() => model.onMove(start)}
                  className="tabular-nums"
                >
                  {timeOfDay(start)}
                </Chip>
              ))}
            </div>
          )}
        </>
      )}
      <KeepBoth model={model} />
    </div>
  );
}
