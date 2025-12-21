"use client";

import { useState } from "react";
import { Id } from "@/types/general";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
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
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { SessionTranscript } from "./session-transcript";
import { useTranscript } from "@/lib/api/meeting-recordings";
import { TranscriptionStatus } from "@/types/meeting-recording";

const OverarchingGoalContainer: React.FC<{
  userId: Id;
}> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get coaching session ID from URL
  const { currentCoachingSessionId } = useCurrentCoachingSession();

  const { overarchingGoal, isLoading, isError, refresh } =
    useOverarchingGoalBySession(currentCoachingSessionId || "");

  // Get transcript to check if one exists
  const { transcript } = useTranscript(currentCoachingSessionId || "");
  const hasTranscript = transcript && transcript.status === TranscriptionStatus.Completed;
  const { create: createOverarchingGoal, update: updateOverarchingGoal } =
    useOverarchingGoalMutation();

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
                <Tabs defaultValue="subgoals">
                  <div className="flex items-center">
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="subgoals">Sub Goals</TabsTrigger>
                      <TabsTrigger value="transcript" className="flex items-center gap-1">
                        Transcript
                        {hasTranscript && (
                          <span className="ml-1 h-2 w-2 rounded-full bg-green-500" />
                        )}
                      </TabsTrigger>
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
                  <TabsContent value="transcript">
                    <SessionTranscript sessionId={currentCoachingSessionId || ""} />
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
