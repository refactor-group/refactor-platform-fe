"use client";

import { Separator } from "@/components/ui/separator";
import { useEffect, useRef, useState } from "react";

import { useAuthStore } from "@/lib/providers/auth-store-provider";

import { siteConfig } from "@/site.config";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";
import { GoalPanel } from "@/components/ui/coaching-sessions/goal-panel";
import { CoachingTabsContainer } from "@/components/ui/coaching-sessions/coaching-tabs-container";
import { EditorCacheProvider } from "@/components/ui/coaching-sessions/editor-cache-context";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import ShareSessionLink from "@/components/ui/share-session-link";
import JoinMeetLink from "@/components/ui/coaching-sessions/join-meet-link";
import { toast } from "sonner";
import { ForbiddenError } from "@/components/ui/errors/forbidden-error";
import { EntityApiError } from "@/types/general";
import { isPastSession } from "@/types/coaching-session";
import { useSidebar } from "@/lib/hooks/use-sidebar";
import { SidebarState, StateChangeSource } from "@/types/sidebar";

/**
 * Determines if coaching relationship ID should be synced from session data.
 * Always sync when store is empty (new tab) or when IDs differ (switching sessions).
 */
function shouldSyncRelationship(
  sessionRelationshipId: string | undefined,
  currentRelationshipId: string | null
): boolean {
  if (!sessionRelationshipId) return false;
  return !currentRelationshipId || sessionRelationshipId !== currentRelationshipId;
}

export default function CoachingSessionsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Get current tab from URL parameter, default to "notes"
  const currentTab = searchParams.get("tab") || "notes";
  const reviewActions = searchParams.get("review") === "true";

  const { userId } = useAuthStore((state) => ({
    userId: state.userId,
  }));

  // Get current coaching session from URL
  const { currentCoachingSession, currentCoachingSessionId, isError } = useCurrentCoachingSession();

  // Get current coaching relationship state and data
  const { currentCoachingRelationshipId, setCurrentCoachingRelationshipId, refresh } =
    useCurrentCoachingRelationship();


  // Auto-collapse main sidebar on coaching session page to maximize workspace,
  // and restore the previous state when leaving.
  const { collapse, state: sidebarState, expand } = useSidebar();
  const previousSidebarState = useRef<SidebarState | null>(null);

  useEffect(() => {
    if (previousSidebarState.current === null) {
      previousSidebarState.current = sidebarState;
    }
    if (sidebarState === SidebarState.Expanded) {
      collapse(StateChangeSource.SystemInitialization);
    }

    return () => {
      if (previousSidebarState.current === SidebarState.Expanded) {
        expand(StateChangeSource.SystemInitialization);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Panel layout state: goals panel collapsible, notes maximizable
  const [notesMaximized, setNotesMaximized] = useState(false);

  // Auto-sync relationship ID when session data loads
  // This ensures the relationship selector always matches the current session
  useEffect(() => {
    if (
      currentCoachingSession?.coaching_relationship_id &&
      shouldSyncRelationship(
        currentCoachingSession.coaching_relationship_id,
        currentCoachingRelationshipId
      )
    ) {
      setCurrentCoachingRelationshipId(
        currentCoachingSession.coaching_relationship_id
      );

      // Force immediate fetch of new relationship data to prevent showing stale cached data
      // This ensures the coaching session title shows the correct coach/coachee names
      refresh();
    }
  }, [
    currentCoachingSession?.coaching_relationship_id,
    currentCoachingRelationshipId,
    setCurrentCoachingRelationshipId,
    refresh,
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

  const handleShareError = (_error: Error) => {
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
    <div className="max-w-screen-2xl flex-1 flex flex-col md:overflow-hidden">
      <EditorCacheProvider sessionId={currentCoachingSessionId || ""}>
        <div className="flex-col pl-4 md:flex">
          <div className="flex flex-col items-start justify-between space-y-2 py-4 px-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
            <CoachingSessionTitle
              locale={siteConfig.locale}
              style={siteConfig.titleStyle}
            />
            <div className="ml-auto flex items-center gap-3 sm:justify-end md:justify-start">
              <JoinMeetLink meetUrl={currentCoachingSession?.meeting_url} />
              <ShareSessionLink
                sessionId={params.id as string}
                onError={handleShareError}
              />
            </div>
          </div>
        </div>

        <div className="px-3">
          <Separator />
        </div>

        <div
          className={`grid grid-cols-1 grid-rows-[auto_1fr] py-3 px-4 flex-1 min-h-0 md:grid-cols-[var(--goals-width)_1fr] md:grid-rows-[1fr] md:transition-[grid-template-columns,gap] md:duration-300 md:ease-in-out ${notesMaximized ? "md:gap-0" : "gap-4"}`}
          style={{
            "--goals-width": notesMaximized ? "40px" : "300px",
          } as React.CSSProperties}
        >
          {currentCoachingSessionId && currentCoachingRelationshipId && (
            <GoalPanel
              coachingSessionId={currentCoachingSessionId}
              coachingRelationshipId={currentCoachingRelationshipId}
              collapsed={notesMaximized}
              readOnly={currentCoachingSession ? isPastSession(currentCoachingSession) : false}
            />
          )}

          <CoachingTabsContainer
            userId={userId}
            defaultValue={currentTab}
            onTabChange={handleTabChange}
            reviewActions={reviewActions}
            notesMaximized={notesMaximized}
            onNotesMaximizedChange={setNotesMaximized}
          />
        </div>
      </EditorCacheProvider>
    </div>
  );
}
