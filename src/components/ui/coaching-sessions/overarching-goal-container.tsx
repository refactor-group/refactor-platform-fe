"use client";

import { useState } from "react";
import { ActionsList } from "@/components/ui/coaching-sessions/actions-list";
import { ActionStatus, Id } from "@/types/general";
import { Action } from "@/types/action";
import { AgreementsList } from "@/components/ui/coaching-sessions/agreements-list";
import { Agreement } from "@/types/agreement";
import {
  createAgreement,
  deleteAgreement,
  updateAgreement,
} from "@/lib/api/agreements";
import { createAction, deleteAction, updateAction } from "@/lib/api/actions";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStateStore } from "@/lib/providers/app-state-store-provider";
import { OverarchingGoal } from "./overarching-goal";

const OverarchingGoalContainer: React.FC<{
  userId: Id;
}> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { coachingSession, coachingRelationship } = useAppStateStore(
    (state) => ({
      coachingSession: state.coachingSession,
      coachingRelationship: state.coachingRelationship,
    })
  );

  const handleAgreementAdded = (body: string): Promise<Agreement> => {
    // Calls the backend endpoint that creates and stores a full Agreement entity
    return createAgreement(coachingSession.id, userId, body)
      .then((agreement) => {
        return agreement;
      })
      .catch((err) => {
        console.error("Failed to create new Agreement: " + err);
        throw err;
      });
  };

  const handleAgreementEdited = (id: Id, body: string): Promise<Agreement> => {
    return updateAgreement(id, coachingSession.id, userId, body)
      .then((agreement) => {
        return agreement;
      })
      .catch((err) => {
        console.error("Failed to update Agreement (id: " + id + "): " + err);
        throw err;
      });
  };

  const handleAgreementDeleted = (id: Id): Promise<Agreement> => {
    return deleteAgreement(id)
      .then((agreement) => {
        return agreement;
      })
      .catch((err) => {
        console.error("Failed to update Agreement (id: " + id + "): " + err);
        throw err;
      });
  };

  const handleActionAdded = (
    body: string,
    status: ActionStatus,
    dueBy: DateTime
  ): Promise<Action> => {
    // Calls the backend endpoint that creates and stores a full Action entity
    return createAction(coachingSession.id, body, status, dueBy)
      .then((action) => {
        return action;
      })
      .catch((err) => {
        console.error("Failed to create new Action: " + err);
        throw err;
      });
  };

  const handleActionEdited = (
    id: Id,
    body: string,
    status: ActionStatus,
    dueBy: DateTime
  ): Promise<Action> => {
    return updateAction(id, coachingSession.id, body, status, dueBy)
      .then((action) => {
        return action;
      })
      .catch((err) => {
        console.error("Failed to update Action (id: " + id + "): " + err);
        throw err;
      });
  };

  const handleActionDeleted = (id: Id): Promise<Action> => {
    return deleteAction(id)
      .then((action) => {
        return action;
      })
      .catch((err) => {
        console.error("Failed to update Action (id: " + id + "): " + err);
        throw err;
      });
  };

  return (
    <div className="grid grid-flow-row auto-rows-min gap-4">
      <div className="row-span-1 pt-4">
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="w-full space-y-2"
        >
          <OverarchingGoal
            onClick={(open: boolean) => setIsOpen(open)}
          ></OverarchingGoal>
          <CollapsibleContent className="px-4">
            <div className="flex-col space-y-4 sm:flex">
              <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
                <Tabs defaultValue="agreements">
                  <div className="flex items-center">
                    <TabsList className="grid grid-cols-3">
                      <TabsTrigger value="agreements">Agreements</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                      <TabsTrigger value="program">Program</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="agreements">
                    <div className="w-full">
                      <AgreementsList
                        coachingSessionId={coachingSession.id}
                        userId={userId}
                        locale={siteConfig.locale}
                        onAgreementAdded={handleAgreementAdded}
                        onAgreementEdited={handleAgreementEdited}
                        onAgreementDeleted={handleAgreementDeleted}
                      ></AgreementsList>
                    </div>
                  </TabsContent>
                  <TabsContent value="actions">
                    <div className="w-full">
                      <ActionsList
                        coachingSessionId={coachingSession.id}
                        userId={userId}
                        locale={siteConfig.locale}
                        onActionAdded={handleActionAdded}
                        onActionEdited={handleActionEdited}
                        onActionDeleted={handleActionDeleted}
                      ></ActionsList>
                    </div>
                  </TabsContent>
                  <TabsContent value="program">
                    {/* <div className="bg-blue-500 text-white">Program</div> */}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export { OverarchingGoalContainer };
