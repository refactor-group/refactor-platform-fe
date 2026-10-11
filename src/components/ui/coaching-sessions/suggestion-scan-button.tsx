"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import { useTapTooltip } from "@/lib/hooks/use-tap-tooltip";
import { ScanStatus } from "@/types/transcript-suggestion";

type Shown = Exclude<ScanStatus, ScanStatus.Unavailable>;

interface Look {
  tooltip: string;
  /** Pressing it would start nothing, so it only explains why. */
  blocked: boolean;
  spinning: boolean;
}

function lookOf(status: Shown): Look {
  switch (status) {
    case ScanStatus.None:
      return {
        tooltip: "Scan the transcript for suggested actions",
        blocked: false,
        spinning: false,
      };
    case ScanStatus.Failed:
      return {
        tooltip: "The last scan failed. Scan the transcript again for suggested actions",
        blocked: false,
        spinning: false,
      };
    case ScanStatus.Pending:
    case ScanStatus.Processing:
      return {
        tooltip: "Scanning the transcript for suggested actions…",
        blocked: true,
        spinning: true,
      };
    case ScanStatus.Completed:
      return {
        tooltip: "Suggested actions were already made for this transcript",
        blocked: true,
        spinning: false,
      };
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled scan status: ${_exhaustive}`);
    }
  }
}

export interface SuggestionScanButtonProps {
  status: ScanStatus;
  onStart: () => void;
}

/** Starts a scan of the transcript for suggested actions, or says why it can't. */
export function SuggestionScanButton({ status, onStart }: SuggestionScanButtonProps) {
  const tap = useTapTooltip();
  if (status === ScanStatus.Unavailable) return null;

  const { tooltip, blocked, spinning } = lookOf(status);

  return (
    <Tooltip {...(blocked ? tap.root : { open: tap.open, onOpenChange: tap.setOpen })}>
      <TooltipTrigger asChild>
        <Button
          {...(blocked ? tap.trigger : { onClick: onStart })}
          variant="ghost"
          size="icon"
          aria-label="Scan transcript for suggested actions"
          aria-disabled={blocked ? "true" : undefined}
          className={cn(
            "h-8 w-8 text-muted-foreground/60 hover:text-foreground max-md:h-10 max-md:w-10",
            blocked && "cursor-default text-muted-foreground/40 hover:bg-transparent hover:text-muted-foreground/40"
          )}
        >
          <RefreshCw className={cn("h-4 w-4", spinning && "animate-spin")} aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64 text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
