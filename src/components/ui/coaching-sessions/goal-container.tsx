"use client";

import { useState } from "react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoalComponent } from "./goal";
import {
  useGoalBySession,
  useGoalMutation,
} from "@/lib/api/goals";
import { Goal } from "@/types/goal";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";

const GoalContainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  // Get coaching session ID from URL
  const { currentCoachingSessionId } = useCurrentCoachingSession();

  const { goal, refresh } =
    useGoalBySession(currentCoachingSessionId || "");
  const { create: createGoal, update: updateGoal } =
    useGoalMutation();

  const handleGoalChange = async (newGoal: Goal) => {
    try {
      if (currentCoachingSessionId) {
        if (goal.id) {
          await updateGoal(
            goal.id,
            newGoal
          );
        } else if (!goal.id) {
          newGoal.coaching_session_id = currentCoachingSessionId;
          await createGoal(newGoal);

          // Manually trigger a local refresh of the cached Goal data such that
          // any other local code using the KeyedMutator will also update with this new data.
          refresh();
        }
      } else {
        console.error(
          "Could not update or create a Goal since coachingSessionId or userId are not set."
        );
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
            onGoalChange={(g: Goal) => handleGoalChange(g)}
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

export { GoalContainer };
