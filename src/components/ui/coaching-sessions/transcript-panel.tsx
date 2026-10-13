"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TranscriptBubble } from "@/components/ui/coaching-sessions/transcript-bubble";
import {
  TranscriptEmptyState,
  type TranscriptEmptyStateVariant,
} from "@/components/ui/coaching-sessions/transcript-empty-state";
import { TranscriptDownloadButton } from "@/components/ui/coaching-sessions/transcript-download-button";
import {
  TRANSCRIPT_HEADER_ACTION_CLASS,
  TRANSCRIPT_HEADER_ACTION_DESKTOP_ONLY,
} from "@/components/ui/coaching-sessions/transcript-header-action";
import { TranscriptSearch } from "@/components/ui/coaching-sessions/transcript-search";
import { TranscriptSpeakerFilter } from "@/components/ui/coaching-sessions/transcript-speaker-filter";
import { groupBubbles } from "@/lib/utils/transcript-group-bubbles";
import { buildSpeakerStyles, speakerStyleFor } from "@/lib/utils/transcript-speakers";
import { downloadScopeFor } from "@/lib/utils/transcript-speaker-roles";
import { ALL_SPEAKERS, useSpeakerFilter } from "@/lib/hooks/use-speaker-filter";
import { markClasses, useTranscriptSearch } from "@/lib/hooks/use-transcript-search";
import { buildSearchMatches } from "@/lib/utils/transcript-search-matches";
import type { Transcription, TranscriptSegment } from "@/types/transcription";
import { TranscriptionStatus } from "@/types/transcription";
import type { MeetingRecording } from "@/types/meeting-recording";
import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import {
  useTranscription,
  useTranscriptionSegments,
} from "@/lib/api/transcriptions";
import { centerInContainer } from "@/lib/utils/center-in-container";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

/** A request to center and mark one segment; a new nonce repeats it. */
export type TranscriptJump = { segmentId: Id; nonce: number };

interface TranscriptPanelProps {
  sessionId: Id;
  meetingUrl: string | undefined;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  jumpTo?: Option<TranscriptJump>;
  /** Called once a jump has been carried out, so the caller can drop the request. */
  onJumpHandled?: (nonce: number) => void;
}

function deriveEmptyState(
  recording: MeetingRecording | null,
  transcription: Transcription | null,
  meetingUrl: string | undefined,
): TranscriptEmptyStateVariant {
  if (!meetingUrl) {
    return { kind: "no-meeting-url" };
  }
  if (!recording) {
    return { kind: "no-recording" };
  }
  switch (recording.status) {
    case MeetingRecordingStatus.Failed:
      return { kind: "recording-failed", errorMessage: recording.error_message };
    case MeetingRecordingStatus.Completed:
    case MeetingRecordingStatus.Cancelled:
      // Cancelled = user stopped early; bot may have produced a partial
      // transcript. Downstream pipeline is identical to Completed.
      if (transcription?.status === TranscriptionStatus.Failed) {
        return { kind: "transcription-failed", errorMessage: transcription.error_message };
      }
      if (transcription?.status === TranscriptionStatus.Completed) {
        return { kind: "no-speech" };
      }
      return { kind: "processing" };
    case MeetingRecordingStatus.Pending:
    case MeetingRecordingStatus.Joining:
    case MeetingRecordingStatus.WaitingRoom:
    case MeetingRecordingStatus.InMeeting:
    case MeetingRecordingStatus.Recording:
    case MeetingRecordingStatus.Processing: {
      const durationMs = recording.started_at
        ? Math.max(0, Date.now() - new Date(recording.started_at).getTime())
        : 0;
      return { kind: "recording-live", durationMs };
    }
    default: {
      const _exhaustive: never = recording.status;
      return _exhaustive;
    }
  }
}

export function TranscriptPanel({
  sessionId,
  meetingUrl,
  isMaximized,
  onToggleMaximize,
  onClose,
  jumpTo = None,
  onJumpHandled,
}: TranscriptPanelProps) {
  const { recording } = useMeetingRecording(sessionId);
  const { transcription } = useTranscription(sessionId);
  const transcriptionId =
    transcription?.status === TranscriptionStatus.Completed ? transcription.id : null;
  const { segments } = useTranscriptionSegments(sessionId, transcriptionId);

  const emptyState = deriveEmptyState(recording, transcription, meetingUrl);
  const hasSegments = segments.length > 0;

  return (
    <Card className="flex flex-col h-full overflow-clip shadow-sm min-h-0">
      {hasSegments && transcriptionId ? (
        <TranscriptPanelWithData
          sessionId={sessionId}
          transcriptionId={transcriptionId}
          segments={segments}
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
          jumpTo={jumpTo}
          onJumpHandled={onJumpHandled}
        />
      ) : (
        <>
          <TranscriptHeader
            isMaximized={isMaximized}
            onToggleMaximize={onToggleMaximize}
            onClose={onClose}
          />
          <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
            <TranscriptEmptyState variant={emptyState} />
          </CardContent>
        </>
      )}
    </Card>
  );
}

// ── Main orchestrator (data-driven) ───────────────────────────────────

interface TranscriptPanelWithDataProps {
  sessionId: Id;
  transcriptionId: Id;
  segments: readonly TranscriptSegment[];
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  jumpTo: Option<TranscriptJump>;
  onJumpHandled?: (nonce: number) => void;
}

function TranscriptPanelWithData({
  sessionId,
  transcriptionId,
  segments,
  isMaximized,
  onToggleMaximize,
  onClose,
  jumpTo,
  onJumpHandled,
}: TranscriptPanelWithDataProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // The latest jump this panel received; it outlives the caller dropping the request.
  const [jump, setJump] = useState<Option<TranscriptJump>>(None);
  if (jumpTo.some && (jump.none || jump.val.nonce !== jumpTo.val.nonce)) {
    setJump(jumpTo);
  }

  const speakerStyles = useMemo(() => buildSpeakerStyles(segments), [segments]);
  const filter = useSpeakerFilter(segments, speakerStyles);
  const search = useTranscriptSearch(filter.visibleSegments, {
    scrollContainerRef,
  });
  const jumped = useSegmentJump(jump, segments, filter, scrollContainerRef, onJumpHandled);

  // Typing a search clears the current jump mark; the next jump marks again.
  const [clearedNonce, setClearedNonce] = useState<Option<number>>(None);
  const marked =
    jump.some && clearedNonce.some && clearedNonce.val === jump.val.nonce ? None : jumped;
  const handleQueryChange = (next: string) => {
    search.setQuery(next);
    if (next.trim() && jump.some) setClearedNonce(Some(jump.val.nonce));
  };

  // Search highlighting wins over the jump mark so marks never nest.
  const renderText = (segment: TranscriptSegment) => {
    const isMarked = marked.some && marked.val === segment.id;
    if (!isMarked || buildSearchMatches(search.query, [segment]).matches.length > 0) {
      return search.renderSegmentText(segment.id, segment.text);
    }
    return (
      <mark data-testid="transcript-jump-mark" className={markClasses(true)}>
        {segment.text}
      </mark>
    );
  };

  // Adjacency is computed against the full transcript — two turns that are
  // visible-adjacent after a filter may not be actually adjacent in the
  // conversation, so each gets its own header in that case.
  const groupings = useMemo(
    () => groupBubbles(filter.visibleSegments, segments),
    [filter.visibleSegments, segments]
  );

  const downloadScope = downloadScopeFor(filter.value, segments);

  return (
    <>
      <TranscriptHeader
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        onClose={onClose}
        download={
          <TranscriptDownloadButton
            sessionId={sessionId}
            transcriptionId={transcriptionId}
            scope={downloadScope}
          />
        }
      />
      <div className="shrink-0 px-4 pt-3 pb-2 space-y-2 border-b border-border/60">
        <TranscriptSearch
          query={search.query}
          onQueryChange={handleQueryChange}
          totalMatches={search.totalMatches}
          activeIndex={search.activeIndex}
          onPrev={search.goPrev}
          onNext={search.goNext}
          onClear={search.clearQuery}
        />
        <TranscriptSpeakerFilter
          options={filter.options}
          value={filter.value}
          onChange={filter.setValue}
        />
      </div>
      <CardContent
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 [scrollbar-width:thin]"
      >
        {filter.visibleSegments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No segments from this speaker.
          </p>
        ) : (
          filter.visibleSegments.map((segment, index) => {
            const style = speakerStyleFor(segment, speakerStyles);
            const grouping = groupings[index];
            const forceHeader = filter.value !== "all";
            return (
              <TranscriptBubble
                key={segment.id}
                segment={segment}
                grouping={grouping}
                alignment={style.alignment}
                variant={style.variant}
                forceHeader={forceHeader}
                renderText={() => renderText(segment)}
              />
            );
          })
        )}
      </CardContent>
    </>
  );
}

// ── Jump to a segment ────────────────────────────────────────────────

/**
 * Handles each new jump: reveals the segment past the speaker filter, centers
 * it, and returns it as the one marked segment until the next jump.
 */
function useSegmentJump(
  jumpTo: Option<TranscriptJump>,
  segments: readonly TranscriptSegment[],
  filter: { value: string; setValue: (next: string) => void },
  scrollContainerRef: RefObject<HTMLDivElement | null>,
  onHandled?: (nonce: number) => void
): Option<Id> {
  const handledNonce = useRef<Option<number>>(None);
  const pendingScroll = useRef<Option<Id>>(None);
  const { value: filterValue, setValue: setFilterValue } = filter;

  useEffect(() => {
    if (jumpTo.none) return;
    const { segmentId, nonce } = jumpTo.val;
    if (handledNonce.current.some && handledNonce.current.val === nonce) return;
    handledNonce.current = Some(nonce);
    onHandled?.(nonce);

    const target = segments.find((s) => s.id === segmentId);
    if (!target) {
      toast.error("That part of the transcript isn't available.");
      return;
    }
    if (filterValue !== ALL_SPEAKERS && target.speaker_label !== filterValue) {
      setFilterValue(ALL_SPEAKERS);
    }
    pendingScroll.current = Some(segmentId);
  }, [jumpTo, segments, filterValue, setFilterValue, onHandled]);

  // Runs after every render so the scroll waits for a filter reset to paint the segment.
  // Scrolls only the transcript, never the page.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (pendingScroll.current.none || !container) return;
    const el = container.querySelector<HTMLElement>(
      `[data-segment-id="${pendingScroll.current.val}"]`
    );
    if (!el) return;
    pendingScroll.current = None;
    centerInContainer(container, el);
  });

  return jumpTo.some && segments.some((s) => s.id === jumpTo.val.segmentId)
    ? Some(jumpTo.val.segmentId)
    : None;
}

// ── Header (shared by empty and data paths) ──────────────────────────

interface TranscriptHeaderProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  /** Absent on the empty-state path, which has nothing to export. */
  download?: ReactNode;
}

function TranscriptHeader({
  isMaximized,
  onToggleMaximize,
  onClose,
  download,
}: TranscriptHeaderProps) {
  return (
    <CardHeader className="p-4 pb-3 shrink-0 border-b border-border/60">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Transcript</h2>
        <TranscriptPanelActions
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
          download={download}
        />
      </div>
    </CardHeader>
  );
}

// ── Header actions ───────────────────────────────────────────────────

interface TranscriptPanelActionsProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  download?: ReactNode;
}

function TranscriptPanelActions({
  isMaximized,
  onToggleMaximize,
  onClose,
  download,
}: TranscriptPanelActionsProps) {
  const maximizeLabel = isMaximized ? "Restore panels" : "Maximize transcript";
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 shrink-0">
        {/* Inside this provider, not a sibling of it: Radix Tooltip throws
            without a TooltipProvider ancestor. */}
        {download}
        <IconButton
          label={maximizeLabel}
          onClick={onToggleMaximize}
          icon={isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        />
        <IconButton
          label="Close transcript"
          onClick={onClose}
          icon={<X className="h-3.5 w-3.5" />}
        />
      </div>
    </TooltipProvider>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}

function IconButton({ label, onClick, icon }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            TRANSCRIPT_HEADER_ACTION_CLASS,
            TRANSCRIPT_HEADER_ACTION_DESKTOP_ONLY
          )}
          onClick={onClick}
          aria-label={label}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
