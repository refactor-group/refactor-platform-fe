"use client";

import { Maximize2, Minimize2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Phase 0 placeholder. Renders the shell of the transcript panel so the
 * three-column layout can be validated visually. Phase 1 replaces the
 * body with real segments, search, speaker filter, and iMessage bubbles.
 */
interface TranscriptPanelProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export function TranscriptPanel({
  isMaximized,
  onToggleMaximize,
  onClose,
}: TranscriptPanelProps) {
  return (
    <Card className="flex flex-col h-full overflow-clip shadow-sm min-h-0">
      <CardHeader className="p-4 pb-3 shrink-0 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Transcript</h2>
          <TranscriptPanelActions
            isMaximized={isMaximized}
            onToggleMaximize={onToggleMaximize}
            onClose={onClose}
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 [scrollbar-width:thin]">
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">
            Transcript will appear here after the meeting ends.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Recording controls and transcript segments will be added in the next phase.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface TranscriptPanelActionsProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

function TranscriptPanelActions({
  isMaximized,
  onToggleMaximize,
  onClose,
}: TranscriptPanelActionsProps) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onToggleMaximize}
        aria-label={isMaximized ? "Restore panels" : "Maximize transcript"}
      >
        {isMaximized ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={onClose}
        aria-label="Close transcript"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
