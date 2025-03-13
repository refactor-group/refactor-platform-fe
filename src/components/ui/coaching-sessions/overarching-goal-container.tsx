"use client";

import { useState } from "react";
import { ActionsList } from "@/components/ui/coaching-sessions/actions-list";
import { ItemStatus, Id } from "@/types/general";
import { Action } from "@/types/action";
import { AgreementsList } from "@/components/ui/coaching-sessions/agreements-list";
import { Agreement, defaultAgreement } from "@/types/agreement";
import { useAgreementMutation } from "@/lib/api/agreements";
import { createAction, deleteAction, updateAction } from "@/lib/api/actions";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverarchingGoalComponent } from "./overarching-goal";
import {
  useOverarchingGoalBySession,
  useOverarchingGoalMutation,
} from "@/lib/api/overarching-goals";
import {
  OverarchingGoal,
  overarchingGoalToString,
} from "@/types/overarching-goal";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";

const OverarchingGoalContainer: React.FC<{
  userId: Id;
}> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentCoachingSessionId } = useCoachingSessionStateStore(
    (state) => state
  );
  const { overarchingGoal, isLoading, isError, refresh } =
    useOverarchingGoalBySession(currentCoachingSessionId);
  const { create: createOverarchingGoal, update: updateOverarchingGoal } =
    useOverarchingGoalMutation();
  const {
    create: createAgreement,
    update: updateAgreement,
    delete: deleteAgreement,
  } = useAgreementMutation();

  const handleAgreementAdded = (body: string): Promise<Agreement> => {
    const newAgreement: Agreement = {
      ...defaultAgreement(),
      coaching_session_id: currentCoachingSessionId,
      user_id: userId,
      body,
    };
    return createAgreement(newAgreement);
  };

  const handleAgreementEdited = (id: Id, body: string): Promise<Agreement> => {
    const updatedAgreement: Agreement = {
      ...defaultAgreement(),
      id,
      coaching_session_id: currentCoachingSessionId,
      user_id: userId,
      body,
    };
    return updateAgreement(id, updatedAgreement);
  };

  const handleAgreementDeleted = (id: Id): Promise<Agreement> => {
    return deleteAgreement(id);
  };

  const handleActionAdded = (
    body: string,
    status: ItemStatus,
    dueBy: DateTime
  ): Promise<Action> => {
    // Calls the backend endpoint that creates and stores a full Action entity
    return createAction(currentCoachingSessionId, body, status, dueBy)
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
    status: ItemStatus,
    dueBy: DateTime
  ): Promise<Action> => {
    return updateAction(id, currentCoachingSessionId, body, status, dueBy)
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

  const handleGoalChange = async (newGoal: OverarchingGoal) => {
    try {
      if (currentCoachingSessionId) {
        if (overarchingGoal.id) {
          const responseGoal = await updateOverarchingGoal(
            overarchingGoal.id,
            newGoal
          );
          console.trace(
            "Updated Overarching Goal: " + overarchingGoalToString(responseGoal)
          );
        } else if (!overarchingGoal.id) {
          newGoal.coaching_session_id = currentCoachingSessionId;
          const responseGoal = await createOverarchingGoal(newGoal);
          console.trace(
            "Newly created Overarching Goal: " +
              overarchingGoalToString(responseGoal)
          );

          // Manually trigger a local refresh of the cached OverarchingGoal data such that
          // any other local code using the KeyedMutator will also update with this new data.
          refresh();
        }
      } else {
        console.error(
          "Could not update or create a Overarching Goal since coachingSessionId or userId are not set."
        );
      }
    } catch (err) {
      console.error("Failed to update or create Overarching Goal: " + err);
    }
  };

  return (
    <div className="grid grid-flow-row auto-rows-min gap-4">
      <div className="row-span-1 pt-4">
        <Collapsible
          open={isOpen}
          onOpenChange={setIsOpen}
          className="w-full space-y-2"
        >
          <OverarchingGoalComponent
            initialValue={overarchingGoal}
            onOpenChange={(open: boolean) => setIsOpen(open)}
            onGoalChange={(goal: OverarchingGoal) => handleGoalChange(goal)}
          ></OverarchingGoalComponent>
          <CollapsibleContent className="px-4">
            <div className="flex-col space-y-4 sm:flex">
              <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
                <Tabs defaultValue="agreements">
                  <div className="flex items-center">
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="agreements">Agreements</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                      <TabsTrigger value="program" className="hidden">
                        Program
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="agreements">
                    <div className="w-full">
                      <AgreementsList
                        coachingSessionId={currentCoachingSessionId}
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
                        coachingSessionId={currentCoachingSessionId}
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
