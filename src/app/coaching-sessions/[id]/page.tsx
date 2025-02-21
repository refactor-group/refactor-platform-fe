"use client";

import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

import { useState } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

import { siteConfig } from "@/site.config";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";
import { OverarchingGoalContainer } from "@/components/ui/coaching-sessions/overarching-goal-container";
import { TipTapEditor } from "@/components/ui/coaching-sessions/tiptap-editor";

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
        <div className="grid h-full items-stretch gap-6 md:grid-cols-[1fr_200px]">
          <div className="flex-col space-y-4 sm:flex md:order-1">
            <Tabs defaultValue="notes">
              <TabsList className="flex w-128 grid-cols-2 justify-start">
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="console" className="hidden">
                  Console
                </TabsTrigger>
                <TabsTrigger value="coachs_notes" className="hidden">
                  <div className="flex gap-2 items-start">
                    <LockClosedIcon className="mt-1" />
                    Coach&#39;s Notes
                  </div>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="notes">
                <div className="flex-col h-full space-y-4">
                  <TipTapEditor />
                </div>
              </TabsContent>
              <TabsContent value="console">
                <div className="p-4 min-h-[400px] md:min-h-[630px] lg:min-h-[630px] bg-gray-500 text-white">
                  Console placeholder
                </div>
              </TabsContent>
              <TabsContent value="coachs_notes">
                <div className="flex h-full flex-col space-y-4">
                  <Textarea
                    placeholder="Coach's notes"
                    className="p-4 min-h-[400px] md:min-h-[630px] lg:min-h-[630px]"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex-col space-y-4 sm:flex md:order-2">
            <div className="grid gap-2 pt-2"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
