"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";
import { AgreementsList } from "@/components/ui/coaching-sessions/agreements-list";
import { ActionsPanel } from "@/components/ui/coaching-sessions/actions-panel";
import { useAgreementMutation } from "@/lib/api/agreements";
import { useActionMutation } from "@/lib/api/actions";
import { useUserActionsList } from "@/lib/api/user-actions";
import { UserActionsScope } from "@/types/assigned-actions";
import { ItemStatus, Id, EntityApiError } from "@/types/general";
import { Action, defaultAction } from "@/types/action";
import { Agreement, defaultAgreement } from "@/types/agreement";
import { DateTime } from "ts-luxon";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { getCoachName, getCoacheeName } from "@/lib/utils/relationship";
import { siteConfig } from "@/site.config";

interface CoachingTabsContainerProps {
  userId: Id;
  defaultValue?: string;
  onTabChange?: (value: string) => void;
  reviewActions: boolean;
}

const CoachingTabsContainer = ({
  userId,
  defaultValue = "notes",
  onTabChange,
  reviewActions = false,
}: CoachingTabsContainerProps) => {
  const [currentTab, setCurrentTab] = useState(defaultValue);

  const handleTabChange = useCallback((value: string) => {
    setCurrentTab(value);
    onTabChange?.(value);
  }, [onTabChange]);

  // Get coaching session ID and data from URL
  const { currentCoachingSessionId, currentCoachingSession } = useCurrentCoachingSession();

  // Get coaching relationship data for coach/coachee names
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  // SWR refresh handles for user action lists. ActionsPanel uses the same
  // hooks with the same params, so SWR deduplicates the fetches — no extra
  // network requests. We need these here so handleAddNoteAsAction (which
  // bypasses ActionsPanel) can trigger the same cache revalidation.
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

  // Agreement and Action mutation hooks
  const {
    create: createAgreement,
    update: updateAgreement,
    delete: deleteAgreement,
    isLoading: isAgreementMutating,
  } = useAgreementMutation();

  const {
    create: createAction,
    update: updateAction,
    delete: deleteAction,
    isLoading: isActionMutating,
  } = useActionMutation();

  // Agreement CRUD handlers
  const handleAgreementAdded = (body: string): Promise<Agreement> => {
    const newAgreement: Agreement = {
      ...defaultAgreement(),
      coaching_session_id: currentCoachingSessionId || "",
      user_id: userId,
      body,
    };
    return createAgreement(newAgreement);
  };

  const handleAgreementEdited = (id: Id, body: string): Promise<Agreement> => {
    const updatedAgreement: Agreement = {
      ...defaultAgreement(),
      id,
      coaching_session_id: currentCoachingSessionId || "",
      user_id: userId,
      body,
    };
    return updateAgreement(id, updatedAgreement);
  };

  const handleAgreementDeleted = (id: Id): Promise<Agreement> => {
    return deleteAgreement(id);
  };

  // Action CRUD handlers — called from ActionsPanel and handleAddNoteAsAction.
  // Both callers guard against a missing currentCoachingSessionId.
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

  const handleActionEdited = (
    id: Id,
    coachingSessionId: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ): Promise<Action> => {
    const updatedAction: Action = {
      ...defaultAction(),
      id,
      coaching_session_id: coachingSessionId,
      user_id: userId,
      body,
      status,
      due_by: dueBy,
      assignee_ids: assigneeIds,
    };
    return updateAction(id, updatedAction);
  };

  const handleActionDeleted = (id: Id): Promise<Action> => {
    return deleteAction(id);
  };

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
      toast.success("Action created from note", {
        action: {
          label: "View Actions",
          onClick: () => handleTabChange("actions"),
        },
      });
    } catch (err) {
      if (err instanceof EntityApiError && err.isNetworkError()) {
        toast.error("Failed to create action. Connection to service was lost.");
      } else {
        toast.error("Failed to create action.");
      }
    }
  }, [currentCoachingSessionId, handleActionAdded, handleTabChange, refreshSessionActions, refreshAllActions]);

  return (
    <div className="row-span-1 h-full py-4 px-4">
      <div className="flex-col space-y-4 sm:flex md:order-1">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList className="flex w-128 grid-cols-3 justify-start">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="agreements">Agreements</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* Always-mounted content controlled by CSS display */}
        <div className="mt-8">
          <div
            className="flex-col h-full space-y-4"
            style={{ display: currentTab === "notes" ? "flex" : "none" }}
          >
            <CoachingNotes onAddAsAction={handleAddNoteAsAction} />
          </div>

          <div style={{ display: currentTab === "agreements" ? "block" : "none" }}>
            <AgreementsList
              coachingSessionId={currentCoachingSessionId || ""}
              userId={userId}
              locale={siteConfig.locale}
              isSaving={isAgreementMutating}
              onAgreementAdded={handleAgreementAdded}
              onAgreementEdited={handleAgreementEdited}
              onAgreementDeleted={handleAgreementDeleted}
            />
          </div>

          <div className="pl-4" style={{ display: currentTab === "actions" ? "block" : "none" }}>
            {currentCoachingSessionId && currentCoachingSession && currentCoachingRelationship && (
              <ActionsPanel
                coachingSessionId={currentCoachingSessionId}
                coachingRelationshipId={currentCoachingRelationship.id}
                sessionDate={currentCoachingSession.date}
                userId={userId}
                locale={siteConfig.locale}
                coachId={currentCoachingRelationship.coach_id}
                coachName={getCoachName(currentCoachingRelationship)}
                coacheeId={currentCoachingRelationship.coachee_id}
                coacheeName={getCoacheeName(currentCoachingRelationship)}
                isSaving={isActionMutating}
                onActionAdded={handleActionAdded}
                onActionEdited={handleActionEdited}
                onActionDeleted={handleActionDeleted}
                reviewActions={reviewActions}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { CoachingTabsContainer };
