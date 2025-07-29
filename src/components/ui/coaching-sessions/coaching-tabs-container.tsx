"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";
import { AgreementsList } from "@/components/ui/coaching-sessions/agreements-list";
import { ActionsList } from "@/components/ui/coaching-sessions/actions-list";
import { useAgreementMutation } from "@/lib/api/agreements";
import { useActionMutation } from "@/lib/api/actions";
import { ItemStatus, Id } from "@/types/general";
import { Action, defaultAction } from "@/types/action";
import { Agreement, defaultAgreement } from "@/types/agreement";
import { DateTime } from "ts-luxon";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { siteConfig } from "@/site.config";

const CoachingTabsContainer: React.FC<{
  userId: Id;
  defaultValue?: string;
  onTabChange?: (value: string) => void;
}> = ({ userId, defaultValue = "notes", onTabChange }) => {
  // Get coaching session ID from URL
  const { currentCoachingSessionId } = useCurrentCoachingSession();

  // Agreement and Action mutation hooks
  const {
    create: createAgreement,
    update: updateAgreement,
    delete: deleteAgreement,
  } = useAgreementMutation();

  const {
    create: createAction,
    update: updateAction,
    delete: deleteAction,
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

  // Action CRUD handlers
  const handleActionAdded = (
    body: string,
    status: ItemStatus,
    dueBy: DateTime
  ): Promise<Action> => {
    const newAction: Action = {
      ...defaultAction(),
      coaching_session_id: currentCoachingSessionId || "",
      user_id: userId,
      body,
      status,
      due_by: dueBy,
    };
    return createAction(newAction);
  };

  const handleActionEdited = (
    id: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime
  ): Promise<Action> => {
    const updatedAction: Action = {
      ...defaultAction(),
      id,
      coaching_session_id: currentCoachingSessionId || "",
      user_id: userId,
      body,
      status,
      due_by: dueBy,
    };
    return updateAction(id, updatedAction);
  };

  const handleActionDeleted = (id: Id): Promise<Action> => {
    return deleteAction(id);
  };

  return (
    <div className="row-span-1 h-full py-4 px-4">
      <div className="flex-col space-y-4 sm:flex md:order-1">
        <Tabs defaultValue={defaultValue} onValueChange={onTabChange}>
          <TabsList className="flex w-128 grid-cols-3 justify-start">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="agreements">Agreements</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          <TabsContent value="notes">
            <div className="flex-col h-full space-y-4">
              <CoachingNotes />
            </div>
          </TabsContent>
          <TabsContent value="agreements">
            <AgreementsList
              coachingSessionId={currentCoachingSessionId || ""}
              userId={userId}
              locale={siteConfig.locale}
              onAgreementAdded={handleAgreementAdded}
              onAgreementEdited={handleAgreementEdited}
              onAgreementDeleted={handleAgreementDeleted}
            />
          </TabsContent>
          <TabsContent value="actions">
            <ActionsList
              coachingSessionId={currentCoachingSessionId || ""}
              userId={userId}
              locale={siteConfig.locale}
              onActionAdded={handleActionAdded}
              onActionEdited={handleActionEdited}
              onActionDeleted={handleActionDeleted}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export { CoachingTabsContainer };