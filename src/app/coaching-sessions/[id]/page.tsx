"use client";

import { Separator } from "@/components/ui/separator";
import { useEffect, useRef } from "react";

import { useAuthStore } from "@/lib/providers/auth-store-provider";

import { siteConfig } from "@/site.config";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";
import { OverarchingGoalContainer } from "@/components/ui/coaching-sessions/overarching-goal-container";
import { CoachingTabsContainer } from "@/components/ui/coaching-sessions/coaching-tabs-container";
import { EditorCacheProvider } from "@/components/ui/coaching-sessions/editor-cache-context";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import ShareSessionLink from "@/components/ui/share-session-link";
import { toast } from "sonner";
import { ForbiddenError } from "@/components/ui/errors/forbidden-error";
import { EntityApiError } from "@/types/general";
import { useStickyTitleSync } from "@/lib/hooks/use-sticky-title-sync";
import { useStickyTitle } from "@/lib/contexts/sticky-title-context";

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

  const { userId, isLoggedIn } = useAuthStore((state) => ({
    userId: state.userId,
    isLoggedIn: state.isLoggedIn,
  }));

  // Get current coaching session from URL
  const { currentCoachingSession, currentCoachingSessionId, isError } = useCurrentCoachingSession();

  // Get current coaching relationship state and data
  const { currentCoachingRelationshipId, setCurrentCoachingRelationshipId, refresh } =
    useCurrentCoachingRelationship();

  // Push session title data into the sticky title context for the site header
  useStickyTitleSync();

  // Show sticky title in site header when the page title scrolls off-screen
  const titleRef = useRef<HTMLDivElement>(null);
  const setStickyVisible = useStickyTitle()?.setVisible ?? null;
  useEffect(() => {
    const el = titleRef.current;
    if (!el || !setStickyVisible) return;

    // rootMargin top = negative header height so "not intersecting" fires
    // right when the title disappears behind the sticky header
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { rootMargin: "-80px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [setStickyVisible]);

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
          <div ref={titleRef} className="flex flex-col items-start justify-between space-y-2 py-4 px-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
            <CoachingSessionTitle
              locale={siteConfig.locale}
              style={siteConfig.titleStyle}
            />
            <div className="ml-auto flex items-center gap-3 sm:justify-end md:justify-start">
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
