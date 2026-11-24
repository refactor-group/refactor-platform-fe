import { ArrowRight } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import type { Option } from "@/types/option";

export interface WeekJump {
  label: string;
  onJump: () => void;
}

export interface EmptyWeekCalloutModel {
  message: string;
  jump: Option<WeekJump>;
}

export enum CalloutPlacement {
  /** Over the grid's empty days. */
  Floating = "floating",
  /** In the phone agenda's flow, flat. */
  Inline = "inline",
}

const PLACEMENT_CLASS: Record<CalloutPlacement, string> = {
  [CalloutPlacement.Floating]: "rounded-popover border bg-popover shadow-popover",
  [CalloutPlacement.Inline]: "mt-4 rounded-xl bg-well",
};

export function EmptyWeekCallout({ model, placement }: { model: EmptyWeekCalloutModel; placement: CalloutPlacement }) {
  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3", PLACEMENT_CLASS[placement])}
    >
      <p className="text-sm text-foreground">{model.message}</p>
      {model.jump.some && (
        <Button variant="link" className="h-auto p-0 tabular-nums" onClick={model.jump.val.onJump}>
          {model.jump.val.label}
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}
