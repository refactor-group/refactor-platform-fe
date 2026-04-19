"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";

/**
 * Sits in the coaching session header next to Join Meeting and Share, and
 * toggles the transcript pane's visibility.
 *
 * Phase 0: simple icon toggle with an active state. Phase 1 adds a status
 * indicator dot driven by recording/transcription status.
 */
interface TranscriptToggleButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function TranscriptToggleButton({
  isOpen,
  onToggle,
}: TranscriptToggleButtonProps) {
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
            aria-label={isOpen ? "Hide transcript" : "Show transcript"}
            aria-pressed={isOpen}
          >
            <FileText className="!h-6 !w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isOpen ? "Hide transcript" : "Show transcript"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
