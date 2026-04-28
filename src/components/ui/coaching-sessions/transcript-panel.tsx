"use client";

import { useMemo, useRef } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

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
import { TranscriptSearch } from "@/components/ui/coaching-sessions/transcript-search";
import { TranscriptSpeakerFilter } from "@/components/ui/coaching-sessions/transcript-speaker-filter";
import { groupBubbles } from "@/lib/transcript/group-bubbles";
import { buildSpeakerStyles, speakerStyleFor } from "@/lib/transcript/speakers";
import { useSpeakerFilter } from "@/lib/hooks/use-speaker-filter";
import { useTranscriptSearch } from "@/lib/hooks/use-transcript-search";
import type { Transcription, TranscriptSegment } from "@/types/transcription";
import { TranscriptionStatus } from "@/types/transcription";
import type { MeetingRecording } from "@/types/meeting-recording";
import { MeetingRecordingStatus } from "@/types/meeting-recording";
import { useMeetingRecording } from "@/lib/api/meeting-recordings";
import { useTranscription, useTranscriptionSegments } from "@/lib/api/transcriptions";
import type { Id } from "@/types/general";

interface TranscriptPanelProps {
  sessionId: Id;
  meetingUrl: string | undefined;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

function deriveEmptyState(
  recording: MeetingRecording | null,
  transcription: Transcription | null,
  meetingUrl: string | undefined,
  onStart: () => void,
  onStop: () => void,
): TranscriptEmptyStateVariant {
  if (!meetingUrl) {
    return { kind: "no-meeting-url" };
  }
  if (!recording) {
    return { kind: "no-recording", canStart: true, onStart };
  }
  if (recording.status === MeetingRecordingStatus.Failed) {
    return { kind: "recording-failed", errorMessage: recording.error_message, onRetry: onStart };
  }
  if (recording.status === MeetingRecordingStatus.Completed) {
    if (transcription?.status === TranscriptionStatus.Failed) {
      return { kind: "transcription-failed", errorMessage: transcription.error_message, onRetry: onStart };
    }
    return { kind: "processing" };
  }
  // Pending / Joining / WaitingRoom / InMeeting / Recording / Processing
  const durationMs = recording.started_at
    ? Math.max(0, Date.now() - new Date(recording.started_at).getTime())
    : 0;
  return { kind: "recording-live", durationMs, onStop };
}

export function TranscriptPanel({
  sessionId,
  meetingUrl,
  isMaximized,
  onToggleMaximize,
  onClose,
}: TranscriptPanelProps) {
  const { recording, startRecording, stopRecording } = useMeetingRecording(sessionId);
  const { transcription } = useTranscription(sessionId);
  const transcriptionId =
    transcription?.status === TranscriptionStatus.Completed ? transcription.id : null;
  const { segments } = useTranscriptionSegments(sessionId, transcriptionId);

  const onStart = () => startRecording(meetingUrl!);
  const emptyState = deriveEmptyState(recording, transcription, meetingUrl, onStart, stopRecording);
  const hasSegments = segments.length > 0;

  return (
    <Card className="flex flex-col h-full overflow-clip shadow-sm min-h-0">
      {hasSegments ? (
        <TranscriptPanelWithData
          segments={segments}
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
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
  segments: readonly TranscriptSegment[];
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

function TranscriptPanelWithData({
  segments,
  isMaximized,
  onToggleMaximize,
  onClose,
}: TranscriptPanelWithDataProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const speakerStyles = useMemo(() => buildSpeakerStyles(segments), [segments]);
  const filter = useSpeakerFilter(segments, speakerStyles);
  const search = useTranscriptSearch(filter.visibleSegments, {
    scrollContainerRef,
  });

  // Adjacency is computed against the full transcript — two turns that are
  // visible-adjacent after a filter may not be actually adjacent in the
  // conversation, so each gets its own header in that case.
  const groupings = useMemo(
    () => groupBubbles(filter.visibleSegments, segments),
    [filter.visibleSegments, segments]
  );

  return (
    <>
      <TranscriptHeader
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        onClose={onClose}
      />
      <div className="shrink-0 px-4 pt-3 pb-2 space-y-2 border-b border-border/60">
        <TranscriptSearch
          query={search.query}
          onQueryChange={search.setQuery}
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
                renderText={(text) => search.renderSegmentText(segment.id, text)}
              />
            );
          })
        )}
      </CardContent>
    </>
  );
}

// ── Header (shared by empty and data paths) ──────────────────────────

interface TranscriptHeaderProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

function TranscriptHeader({
  isMaximized,
  onToggleMaximize,
  onClose,
}: TranscriptHeaderProps) {
  return (
    <CardHeader className="p-4 pb-3 shrink-0 border-b border-border/60">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight">Transcript</h2>
        <TranscriptPanelActions
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
          onClose={onClose}
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
}

function TranscriptPanelActions({
  isMaximized,
  onToggleMaximize,
  onClose,
}: TranscriptPanelActionsProps) {
  const maximizeLabel = isMaximized ? "Restore panels" : "Maximize transcript";
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 shrink-0">
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
          className="hidden md:inline-flex h-7 w-7 p-0 text-muted-foreground/50 hover:text-foreground"
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
