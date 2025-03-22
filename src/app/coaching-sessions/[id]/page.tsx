"use client";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useState } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

import { siteConfig } from "@/site.config";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";
import { OverarchingGoalContainer } from "@/components/ui/coaching-sessions/overarching-goal-container";
import { CoachingNotes } from "@/components/ui/coaching-sessions/coaching-notes";

import { LockClosedIcon } from "@radix-ui/react-icons";
import CoachingSessionSelector from "@/components/ui/coaching-session-selector";
import { useRouter } from "next/navigation";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";

export default function CoachingSessionsPage() {
  const router = useRouter();
  const { userId } = useAuthStore((state) => ({ userId: state.userId }));
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );

  const handleTitleRender = (sessionTitle: string) => {
    document.title = sessionTitle;
  };

  const handleCoachingSessionSelect = (coachingSessionId: string) => {
    console.debug("coachingSessionId selected: " + coachingSessionId);
    router.push(`/coaching-sessions/${coachingSessionId}`);
  };

  return (
    // Never grow wider than the site-header
    <div className="max-w-screen-2xl">
      <div className="flex-col h-full md:flex ">
        <div className="flex flex-col items-start justify-between space-y-2 py-4 px-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
          <CoachingSessionTitle
            locale={siteConfig.locale}
            style={siteConfig.titleStyle}
            onRender={handleTitleRender}
          ></CoachingSessionTitle>
          <div className="ml-auto flex w-full sm:max-w-sm md:max-w-md space-x-2 sm:justify-end md:justify-start">
            <CoachingSessionSelector
              relationshipId={currentCoachingRelationshipId}
              disabled={!currentCoachingRelationshipId}
              onSelect={handleCoachingSessionSelect}
            ></CoachingSessionSelector>
          </div>
        </div>
      </div>

      <Separator />

      <OverarchingGoalContainer userId={userId} />

      <div className="row-span-1 h-full py-4 px-4">
        <div className="flex-col space-y-4 sm:flex md:order-1">
          <Tabs defaultValue="notes">
            <TabsList className="flex w-128 grid-cols-2 justify-start">
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="notes">
              <div className="flex-col h-full space-y-4">
                <CoachingNotes />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
