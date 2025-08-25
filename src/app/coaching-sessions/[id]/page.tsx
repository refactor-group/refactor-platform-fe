"use client";

import { Separator } from "@/components/ui/separator";
import { useCallback, useEffect } from "react";

import { useAuthStore } from "@/lib/providers/auth-store-provider";

import { siteConfig } from "@/site.config";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";
import { OverarchingGoalContainer } from "@/components/ui/coaching-sessions/overarching-goal-container";
import { CoachingTabsContainer } from "@/components/ui/coaching-sessions/coaching-tabs-container";
import { EditorCacheProvider } from "@/components/ui/coaching-sessions/editor-cache-context";

import CoachingSessionSelector from "@/components/ui/coaching-session-selector";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import ShareSessionLink from "@/components/ui/share-session-link";
import { toast } from "sonner";
import { ForbiddenError } from "@/components/ui/errors/forbidden-error";
import { EntityApiError } from "@/types/general";

export default function CoachingSessionsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Get current tab from URL parameter, default to "notes"
  const currentTab = searchParams.get("tab") || "notes";

  const { userId, isLoggedIn } = useAuthStore((state) => ({
    userId: state.userId,
    isLoggedIn: state.isLoggedIn,
  }));

  // Get current coaching session from URL
  const { currentCoachingSession, currentCoachingSessionId, isError } = useCurrentCoachingSession();

  // Get current coaching relationship state and data
  const { currentCoachingRelationshipId, setCurrentCoachingRelationshipId } =
    useCurrentCoachingRelationship();

  const handleTitleRender = useCallback((sessionTitle: string) => {
    document.title = sessionTitle;
  }, []);

  // Auto-sync relationship ID when session data loads (if not already set)
  useEffect(() => {
    if (
      currentCoachingSession?.coaching_relationship_id &&
      !currentCoachingRelationshipId
    ) {
      setCurrentCoachingRelationshipId(
        currentCoachingSession.coaching_relationship_id
      );
    }
    // setCurrentCoachingRelationshipId is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentCoachingSession?.coaching_relationship_id,
    currentCoachingRelationshipId,
  ]);

  // Check for 403 Forbidden error AFTER all hooks are called
  if (isError && isError instanceof EntityApiError && isError.status === 403) {
    return (
      <ForbiddenError
        title="Coaching Session Access Denied"
        message="You don't have permission to access this coaching session. Only the coach and coachee can view this session."
      />
    );
  }

  const handleCoachingSessionSelect = (coachingSessionId: string) => {
    console.debug("coachingSessionId selected: " + coachingSessionId);
    router.push(`/coaching-sessions/${coachingSessionId}`);
  };

  const handleShareError = (error: Error) => {
    toast.error("Failed to copy session link.");
  };

  const handleTabChange = (tabValue: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    if (tabValue === "notes") {
      // Remove tab parameter for default tab to keep URL clean
      newSearchParams.delete("tab");
    } else {
      newSearchParams.set("tab", tabValue);
    }

    const newUrl = newSearchParams.toString()
      ? `${window.location.pathname}?${newSearchParams.toString()}`
      : window.location.pathname;

    router.replace(newUrl, { scroll: false });
  };

  return (
    // Never grow wider than the site-header
    <div className="max-w-screen-2xl">
      <EditorCacheProvider sessionId={currentCoachingSessionId || ""}>
        <div className="flex-col h-full pl-4 md:flex ">
          <div className="flex flex-col items-start justify-between space-y-2 py-4 px-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
            <CoachingSessionTitle
              locale={siteConfig.locale}
              style={siteConfig.titleStyle}
              onRender={handleTitleRender}
            />
            <div className="ml-auto flex w-full sm:max-w-sm md:max-w-md items-center gap-3 sm:justify-end md:justify-start">
              <ShareSessionLink
                sessionId={params.id as string}
                onError={handleShareError}
              />
              <CoachingSessionSelector
                relationshipId={currentCoachingRelationshipId}
                disabled={!currentCoachingRelationshipId}
                onSelect={handleCoachingSessionSelect}
              />
            </div>
          </div>
        </div>

        <div className="px-3">
          <Separator />
        </div>

        <OverarchingGoalContainer userId={userId} />

        <CoachingTabsContainer
          userId={userId}
          defaultValue={currentTab}
          onTabChange={handleTabChange}
        />
      </EditorCacheProvider>
    </div>
  );
}
