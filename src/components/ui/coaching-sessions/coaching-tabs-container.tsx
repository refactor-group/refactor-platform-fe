"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";
import { AgreementsList } from "@/components/ui/coaching-sessions/agreements-list";
import { ActionsPanel } from "@/components/ui/coaching-sessions/actions-panel";
import { useAgreementMutation } from "@/lib/api/agreements";
import { useActionMutation } from "@/lib/api/actions";
import { ItemStatus, Id } from "@/types/general";
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
}

const CoachingTabsContainer = ({
  userId,
  defaultValue = "notes",
  onTabChange,
}: CoachingTabsContainerProps) => {
  const [currentTab, setCurrentTab] = useState(defaultValue);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    onTabChange?.(value);
  };
  // Get coaching session ID and data from URL
  const { currentCoachingSessionId, currentCoachingSession } = useCurrentCoachingSession();

  // Get coaching relationship data for coach/coachee names
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

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

  // Action CRUD handlers (only called when ActionsPanel is rendered, which
  // guarantees currentCoachingSessionId is non-null via the render guard)
  const handleActionAdded = (
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
  };

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
        <div className="mt-8 pl-4">
          <div 
            className="flex-col h-full space-y-4"
            style={{ display: currentTab === "notes" ? "flex" : "none" }}
          >
            <CoachingNotes />
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
          
          <div style={{ display: currentTab === "actions" ? "block" : "none" }}>
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
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { CoachingTabsContainer };
