"use client";

import { Separator } from "@/components/ui/separator";
import { useCallback, useEffect, useRef } from "react";

import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useAddFromNotes } from "@/lib/hooks/use-add-from-notes";

import { siteConfig } from "@/site.config";
import { CoachingSessionTitle } from "@/components/ui/coaching-sessions/coaching-session-title";
import { CoachingSessionPanel } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { CoachingTabsContainer } from "@/components/ui/coaching-sessions/coaching-tabs-container";
import { TranscriptPanel } from "@/components/ui/coaching-sessions/transcript-panel";
import { TranscriptToggleButton } from "@/components/ui/coaching-sessions/transcript-toggle-button";
import { JoinMeetingButton } from "@/components/ui/coaching-sessions/join-meeting-button";
import {
  IndicatorStatus,
  deriveIndicatorStatus,
} from "@/lib/transcript/indicator-status";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import { useTranscription } from "@/lib/api/transcriptions";
import { useTranscriptionToasts } from "@/lib/hooks/use-transcription-toasts";
import { useUiPreferencesStore } from "@/lib/providers/ui-preferences-state-store-provider";
import { TranscriptionStatus } from "@/types/transcription";
import { EditorCacheProvider } from "@/components/ui/coaching-sessions/editor-cache-context";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentRelationshipRole } from "@/lib/hooks/use-current-relationship-role";
import { useCoachingSessionLayout } from "@/lib/hooks/use-coaching-session-layout";
import ShareSessionLink from "@/components/ui/share-session-link";
import { toast } from "sonner";
import { ForbiddenError } from "@/components/ui/errors/forbidden-error";
import { EntityApiError } from "@/types/general";
import { isPastSession } from "@/types/coaching-session";
import type { CoachingSession } from "@/types/coaching-session";
import { FocusedPanel } from "@/types/coaching-session-layout";

import { DateTime } from "ts-luxon";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { useSidebar } from "@/lib/hooks/use-sidebar";
import { SidebarState, StateChangeSource } from "@/types/sidebar";

const COLLAPSED_GOALS_WIDTH = "40px";
const EXPANDED_GOALS_WIDTH = "300px";
// `minmax(280px, 440px)` lets the transcript shrink from 440 down to a
// 280-px readability floor when the viewport gets tight between md: and
// wider desktop widths — keeps Notes from being crushed.
const DOCKED_TRANSCRIPT_WIDTH = "minmax(280px,440px)";
const FLEX_COL = "minmax(0,1fr)";

/**
 * Goals are read-only on past sessions for coachees, but coaches retain
 * full add/remove/edit access so they can adjust goals retroactively.
 */
function isGoalPanelReadOnly(
  session: CoachingSession,
  timezone: string,
  isCoach: boolean
): boolean {
  const isPast = isPastSession(session, {
    cutoff: DateTime.fromISO(session.date, { zone: 'utc' })
      .setZone(timezone)
      .endOf('day'),
  });
  return isPast && !isCoach;
}

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

/**
 * Derives the CSS grid column template from layout state.
 *
 * Four distinct layouts, each expressed as a single grid-template-columns string:
 *   - Notes maximized:      [rail][notes]
 *   - Transcript maximized: [rail][transcript]    (notes hidden)
 *   - Transcript docked:    [goals/rail][transcript][notes]
 *   - Default:              [goals][notes]
 *
 * `minmax(0, 1fr)` (not bare `1fr`) is required on the flex column so the
 * child's overflow-y-auto can actually trigger — otherwise the row stretches
 * to fit content and internal scrolling breaks.
 */
function computeGridColumns(
  focusedPanel: FocusedPanel,
  isTranscriptOpen: boolean,
  isGoalsCollapsed: boolean
): string {
  const goalsColumn = isGoalsCollapsed ? COLLAPSED_GOALS_WIDTH : EXPANDED_GOALS_WIDTH;
  const isDockedThreeColumn =
    focusedPanel === FocusedPanel.None && isTranscriptOpen;
  if (isDockedThreeColumn) {
    return `${goalsColumn} ${DOCKED_TRANSCRIPT_WIDTH} ${FLEX_COL}`;
  }
  return `${goalsColumn} ${FLEX_COL}`;
}

export default function CoachingSessionsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Panel section persisted via URL param "panel".
  // Also recognize the legacy "tab" param so old bookmarks still work.
  const panelParam = searchParams.get("panel") ?? searchParams.get("tab");
  const panelSection = panelParam === PanelSection.Goals
    ? PanelSection.Goals
    : panelParam === PanelSection.Agreements
      ? PanelSection.Agreements
      : panelParam === PanelSection.Actions
        ? PanelSection.Actions
        : PanelSection.Topics;

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  // Get current coaching session from URL
  const { currentCoachingSession, currentCoachingSessionId, isError } = useCurrentCoachingSession();

  // Get current coaching relationship state and data
  const { currentCoachingRelationshipId, setCurrentCoachingRelationshipId, refresh } =
    useCurrentCoachingRelationship();

  // Coaches can still add/remove goals on past sessions; coachees cannot
  const { isCoachInCurrentRelationship } = useCurrentRelationshipRole();

  // Three-pane layout state (focus mode + transcript visibility). URL-backed.
  const layout = useCoachingSessionLayout();

  const handlePanelSectionChange = useCallback(
    (section: PanelSection) => {
      const newSearchParams = new URLSearchParams(searchParams);
      if (section === PanelSection.Topics) {
        // Remove panel parameter for the default section to keep URL clean
        newSearchParams.delete("panel");
      } else {
        newSearchParams.set("panel", section);
      }

      const newUrl = newSearchParams.toString()
        ? `${window.location.pathname}?${newSearchParams.toString()}`
        : window.location.pathname;

      router.replace(newUrl, { scroll: false });
    },
    [searchParams, router]
  );

  // Bridge the notes "Add as …" affordance to the panel: a selection becomes a
  // NoteSelection carrying its target section, pinned to the URL once expanded.
  const { selection: noteSelection, addFromNote } = useAddFromNotes({
    isGoalsCollapsed: layout.isGoalsCollapsed,
    toggleGoalsCollapsed: layout.toggleGoalsCollapsed,
    pinSection: handlePanelSectionChange,
  });

  // Recording and transcription status — used for the header indicator.
  // TranscriptPanel calls the same hooks internally; SWR deduplicates the requests.
  const { recording } = useMeetingRecording(currentCoachingSessionId ?? null);
  const { transcription } = useTranscription(currentCoachingSessionId ?? null);
  const baseIndicatorStatus = deriveIndicatorStatus({
    recordingStatus: recording?.status,
    transcriptionStatus: transcription?.status,
  });

  // Suppress the "transcript ready" green dot once the user has opened the
  // panel for this transcript. Persisted across reload via UI prefs store.
  const viewedTranscripts = useUiPreferencesStore((s) => s.viewedTranscripts);
  const markTranscriptViewed = useUiPreferencesStore(
    (s) => s.markTranscriptViewed
  );
  const transcriptIsViewed =
    currentCoachingSessionId &&
    transcription?.id &&
    viewedTranscripts[currentCoachingSessionId] === transcription.id;
  const indicatorStatus =
    baseIndicatorStatus === IndicatorStatus.TranscriptReady &&
    transcriptIsViewed
      ? IndicatorStatus.None
      : baseIndicatorStatus;

  // Wrap toggle so that opening the panel marks the current transcript
  // as viewed (clears the badge dot, suppresses repeat ready toasts).
  const handleToggleTranscript = () => {
    const willOpen = !layout.isTranscriptOpen;
    if (
      willOpen &&
      currentCoachingSessionId &&
      transcription?.id &&
      transcription.status === TranscriptionStatus.Completed
    ) {
      markTranscriptViewed(currentCoachingSessionId, transcription.id);
    }
    layout.toggleTranscript();
  };

  useTranscriptionToasts({
    sessionId: currentCoachingSessionId ?? null,
    onOpenTranscript: () => {
      if (
        currentCoachingSessionId &&
        transcription?.id &&
        transcription.status === TranscriptionStatus.Completed
      ) {
        markTranscriptViewed(currentCoachingSessionId, transcription.id);
      }
      layout.openTranscript();
    },
  });

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

  const gridColumns = computeGridColumns(
    layout.focusedPanel,
    layout.isTranscriptOpen,
    layout.isGoalsCollapsed
  );

  // When the transcript is maximized, Notes is hidden. When Notes is maximized,
  // the hook's toggle closes the transcript, so we never need to render it.
  const shouldRenderTranscript =
    layout.isTranscriptOpen && !layout.isNotesMaximized;
  const shouldRenderNotes = !layout.isTranscriptMaximized;

  return (
    // Never grow wider than the site-header
    <div className="max-w-screen-2xl flex-1 flex flex-col min-h-0 md:overflow-hidden">
      <EditorCacheProvider sessionId={currentCoachingSessionId || ""}>
        <div className="flex-col pl-4 md:flex">
          <div className="flex flex-col items-start justify-between space-y-2 py-5 px-4 sm:flex-row sm:items-center sm:space-y-0 md:min-h-16">
            <CoachingSessionTitle locale={siteConfig.locale} />
            <div className="ml-auto flex items-center gap-3 sm:justify-end md:justify-start">
              <JoinMeetingButton
                sessionId={currentCoachingSessionId ?? null}
                meetingUrl={currentCoachingSession?.meeting_url}
                isCoach={isCoachInCurrentRelationship}
              />
              <TranscriptToggleButton
                isOpen={layout.isTranscriptOpen}
                onToggle={handleToggleTranscript}
                indicatorStatus={indicatorStatus}
              />
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
          className="grid grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 py-3 px-4 flex-1 min-h-0 md:grid-rows-[minmax(0,1fr)] md:[grid-template-columns:var(--session-grid-cols)] md:transition-[grid-template-columns,gap] md:duration-300 md:ease-in-out"
          style={
            { "--session-grid-cols": gridColumns } as React.CSSProperties
          }
        >
          {currentCoachingSessionId && currentCoachingRelationshipId && (
            <CoachingSessionPanel
              coachingSessionId={currentCoachingSessionId}
              coachingRelationshipId={currentCoachingRelationshipId}
              collapsed={layout.isGoalsCollapsed}
              onToggleCollapsed={layout.toggleGoalsCollapsed}
              readOnly={currentCoachingSession
                ? isGoalPanelReadOnly(
                    currentCoachingSession,
                    userSession?.timezone || getBrowserTimezone(),
                    isCoachInCurrentRelationship
                  )
                : false}
              defaultSection={panelSection}
              onSectionChange={handlePanelSectionChange}
              noteSelection={noteSelection}
            />
          )}

          {shouldRenderTranscript && currentCoachingSessionId && (
            <TranscriptPanel
              sessionId={currentCoachingSessionId}
              meetingUrl={currentCoachingSession?.meeting_url}
              isMaximized={layout.isTranscriptMaximized}
              onToggleMaximize={layout.toggleTranscriptMaximized}
              onClose={layout.closeTranscript}
            />
          )}

          {shouldRenderNotes && (
            <CoachingTabsContainer
              isMaximized={layout.isNotesMaximized}
              onToggleMaximize={layout.toggleNotesMaximized}
              onAddFromNote={addFromNote}
            />
          )}
        </div>
      </EditorCacheProvider>
    </div>
  );
}
