"use client";

import { useState } from "react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalComponent } from "./goal";
import {
  useGoalsBySession,
  useGoalMutation,
} from "@/lib/api/goals";
import { defaultGoal, Goal } from "@/types/goal";
import { Id } from "@/types/general";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";

interface GoalContainerInnerProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
}

const GoalContainerInner: React.FC<GoalContainerInnerProps> = ({
  coachingSessionId,
  coachingRelationshipId,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const { goals, refresh } =
    useGoalsBySession(coachingSessionId);
  const goal = goals.length > 0 ? goals[0] : defaultGoal();
  const { create: createGoal, update: updateGoal } =
    useGoalMutation();

  const handleGoalChange = async (currentGoal: Goal, newGoal: Goal) => {
    try {
      if (currentGoal.id) {
        await updateGoal(currentGoal.id, newGoal);
      } else {
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        await createGoal(newGoal);

        // Manually trigger a local refresh of the cached Goal data such that
        // any other local code using the KeyedMutator will also update with this new data.
        refresh();
      }
    } catch (err) {
      console.error("Failed to update or create Goal: " + err);
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
          <GoalComponent
            initialValue={goal}
            onOpenChange={(open: boolean) => setIsOpen(open)}
            onGoalChange={(g: Goal) => handleGoalChange(goal, g)}
          ></GoalComponent>
          <CollapsibleContent className="px-4">
            <div className="flex-col space-y-4 sm:flex">
              <div className="grid flex-1 items-start gap-4 sm:py-0 md:gap-8">
                <Tabs defaultValue="subgoals">
                  <div className="flex items-center">
                    <TabsList className="grid grid-cols-1">
                      <TabsTrigger value="subgoals">Sub Goals</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="subgoals">
                    <div className="w-full">
                      {/* Empty area for future Sub Goals implementation */}
                      <div className="bg-inherit rounded-lg border border-gray-200 p-6">
                        <p className="text-gray-500 text-center">Sub Goals coming soon...</p>
                      </div>
                    </div>
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

const GoalContainer: React.FC = () => {
  const { currentCoachingSessionId } = useCurrentCoachingSession();
  const { currentCoachingRelationshipId } = useCurrentCoachingRelationship();

  // Guard: only render when both session and relationship IDs are available
  if (!currentCoachingSessionId || !currentCoachingRelationshipId) {
    return null;
  }

  return (
    <GoalContainerInner
      coachingSessionId={currentCoachingSessionId}
      coachingRelationshipId={currentCoachingRelationshipId}
    />
  );
};

export { GoalContainer };
