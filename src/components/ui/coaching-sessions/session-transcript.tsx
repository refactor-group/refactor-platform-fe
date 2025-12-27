"use client";

import { FileText, Loader2 } from "lucide-react";
import { useTranscript, useTranscriptSegments } from "@/lib/api/meeting-recordings";
import { useAiSuggestions } from "@/lib/api/ai-suggestions";
import { Id } from "@/types/general";
import { TranscriptionStatus } from "@/types/meeting-recording";
import { TranscriptSegment } from "./transcript-segment";
import { AiSuggestionsPanel } from "./ai-suggestions-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface SessionTranscriptProps {
  sessionId: Id;
}

/**
 * Displays the transcript for a coaching session.
 * Shows transcript segments with speaker diarization and AI suggestions panel.
 */
export function SessionTranscript({ sessionId }: SessionTranscriptProps) {
  const { transcript, isLoading: transcriptLoading } = useTranscript(sessionId);
  const { segments, isLoading: segmentsLoading } = useTranscriptSegments(sessionId);
  const { suggestions, refresh: refreshSuggestions } = useAiSuggestions(sessionId);

  const isLoading = transcriptLoading || segmentsLoading;

  // No transcript yet
  if (!isLoading && !transcript) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-center">
            No transcript available yet.
            <br />
            <span className="text-sm">Record a session to generate a transcript.</span>
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Transcript is processing
  if (transcript?.status === TranscriptionStatus.Processing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Transcription in progress...</p>
          <Badge variant="secondary">Processing audio</Badge>
        </div>
      </div>
    );
  }

  // Transcript failed
  if (transcript?.status === TranscriptionStatus.Failed) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <FileText className="h-12 w-12 text-destructive/50" />
          <p className="text-destructive">Transcription failed</p>
          {transcript.error_message && (
            <p className="text-sm text-muted-foreground">{transcript.error_message}</p>
          )}
        </div>
      </div>
    );
  }

  // Filter pending suggestions
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");

  return (
    <div className="space-y-6">
      {/* Metadata bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {transcript?.word_count && (
          <span>{transcript.word_count.toLocaleString()} words</span>
        )}
        {transcript?.confidence_score && (
          <span>{Math.round(transcript.confidence_score * 100)}% confidence</span>
        )}
        {segments.length > 0 && (
          <span>{segments.length} segments</span>
        )}
      </div>

      {/* AI Suggestions Panel (if any pending) */}
      {pendingSuggestions.length > 0 && (
        <AiSuggestionsPanel
          suggestions={pendingSuggestions}
          onSuggestionAction={refreshSuggestions}
        />
      )}

      {/* Transcript content */}
      {segments.length > 0 ? (
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-0">
            {segments.map((segment) => (
              <TranscriptSegment key={segment.id} segment={segment} />
            ))}
          </div>
        </ScrollArea>
      ) : transcript?.full_text ? (
        <ScrollArea className="h-[500px] pr-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap">{transcript.full_text}</p>
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No transcript content available.
        </div>
      )}
    </div>
  );
}
