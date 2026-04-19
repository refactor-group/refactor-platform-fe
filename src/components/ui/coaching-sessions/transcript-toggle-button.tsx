"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TranscriptStatusIndicator } from "@/components/ui/coaching-sessions/transcript-status-indicator";
import { cn } from "@/components/lib/utils";
import { IndicatorStatus } from "@/lib/transcript/indicator-status";

/**
 * Sits in the coaching session header next to Join Meeting and Share.
 * Toggles the transcript panel's visibility and carries a small status
 * indicator (red pulsing / solid green / amber !) that reflects the
 * current recording and transcription state.
 */
interface TranscriptToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  /** Status indicator to render on top of the icon. Defaults to None. */
  indicatorStatus?: IndicatorStatus;
  /** Additional tooltip context appended to the default "Show/Hide transcript" label. */
  indicatorTooltip?: string;
}

export function TranscriptToggleButton({
  isOpen,
  onToggle,
  indicatorStatus = IndicatorStatus.None,
  indicatorTooltip,
}: TranscriptToggleButtonProps) {
  const baseLabel = isOpen ? "Hide transcript" : "Show transcript";
  const tooltipText = indicatorTooltip
    ? `${baseLabel} · ${indicatorTooltip}`
    : baseLabel;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 relative",
              isOpen && "bg-accent text-accent-foreground"
            )}
            onClick={onToggle}
            aria-label={baseLabel}
            aria-pressed={isOpen}
          >
            <FileText className="!h-6 !w-6" />
            <TranscriptStatusIndicator
              status={indicatorStatus}
              className="absolute top-1 right-1"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
