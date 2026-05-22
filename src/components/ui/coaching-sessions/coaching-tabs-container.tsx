"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";
import { useActionMutation } from "@/lib/api/actions";
import { useUserActionsList } from "@/lib/api/user-actions";
import { UserActionsScope } from "@/types/assigned-actions";
import { ItemStatus, Id, EntityApiError } from "@/types/general";
import { defaultAction } from "@/types/action";
import type { Action } from "@/types/action";
import { DateTime } from "ts-luxon";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";

interface CoachingTabsContainerProps {
  userId: Id;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

const CoachingTabsContainer = ({
  userId,
  isMaximized = false,
  onToggleMaximize,
}: CoachingTabsContainerProps) => {
  // Get coaching session ID and data from URL
  const { currentCoachingSessionId } = useCurrentCoachingSession();

  // Get coaching relationship data
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  // SWR refresh handles for user action lists. The panel uses the same
  // hooks with the same params, so SWR deduplicates the fetches — no extra
  // network requests. We need these here so handleAddNoteAsAction can
  // trigger the same cache revalidation.
  const { refresh: refreshSessionActions } = useUserActionsList(
    userId,
    currentCoachingSessionId
      ? { scope: UserActionsScope.Sessions, coaching_session_id: currentCoachingSessionId }
      : undefined
  );
  const { refresh: refreshAllActions } = useUserActionsList(
    userId,
    currentCoachingRelationship
      ? { scope: UserActionsScope.Sessions, coaching_relationship_id: currentCoachingRelationship.id }
      : undefined
  );

  // Action mutation hook (for creating actions from notes)
  const { create: createAction } = useActionMutation();

  const handleActionAdded = useCallback((
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ): Promise<Action> => {
    const newAction: Action = {
      ...defaultAction(),
      coaching_session_id: currentCoachingSessionId!,
      user_id: userId,
      body,
      status,
      due_by: dueBy,
      assignee_ids: assigneeIds,
    };
    return createAction(newAction);
  }, [currentCoachingSessionId, userId, createAction]);

  // Create an action from selected text in coaching notes
  const handleAddNoteAsAction = useCallback(async (selectedText: string) => {
    if (!currentCoachingSessionId) return;

    const trimmed = selectedText.trim();
    if (!trimmed) return;

    try {
      await handleActionAdded(
        trimmed,
        ItemStatus.NotStarted,
        DateTime.now().plus({ days: 7 }),
      );
      refreshSessionActions();
      refreshAllActions();
      toast.success("Action created from note");
    } catch (err) {
      if (err instanceof EntityApiError && err.isNetworkError()) {
        toast.error("Failed to create action. Connection to service was lost.");
      } else {
        toast.error("Failed to create action.");
      }
    }
  }, [currentCoachingSessionId, handleActionAdded, refreshSessionActions, refreshAllActions]);

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
          <CoachingNotes onAddAsAction={handleAddNoteAsAction} />
        </div>
      </CardContent>
    </Card>
  );
};

export { CoachingTabsContainer };
