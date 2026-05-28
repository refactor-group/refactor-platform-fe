"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";

interface CoachingTabsContainerProps {
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  /** Forwards text selected in the notes to the panel's add-action flow. */
  onAddActionFromNote: (selectedText: string) => void;
}

const CoachingTabsContainer = ({
  isMaximized = false,
  onToggleMaximize,
  onAddActionFromNote,
}: CoachingTabsContainerProps) => {
  return (
    <Card className="row-span-1 h-full flex flex-col min-h-0 min-w-0">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Notes</h3>
          {onToggleMaximize && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:inline-flex h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
                  onClick={onToggleMaximize}
                  aria-label={isMaximized ? "Restore panels" : "Maximize notes"}
                >
                  {isMaximized ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isMaximized ? "Restore panels" : "Maximize notes"}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 flex-1 flex flex-col min-h-0 min-w-0">
        <div className="mt-4 flex-1 flex flex-col min-h-0 min-w-0">
          <CoachingNotes onAddAsAction={onAddActionFromNote} />
        </div>
      </CardContent>
    </Card>
  );
};

export { CoachingTabsContainer };
