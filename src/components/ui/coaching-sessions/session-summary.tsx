"use client";

import { FileText, Loader2 } from "lucide-react";
import { useTranscript } from "@/lib/api/meeting-recordings";
import { Id } from "@/types/general";
import { TranscriptionStatus } from "@/types/meeting-recording";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SessionSummaryProps {
  coachingSessionId: Id;
}

/**
 * Displays the AI-generated summary for a coaching session.
 * Shows empty state when no summary is available.
 */
export function SessionSummary({ coachingSessionId }: SessionSummaryProps) {
  const { transcript, isLoading } = useTranscript(coachingSessionId);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No transcript or no summary
  if (!transcript || !transcript.summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <FileText className="h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground text-center">
            No summary available yet.
            <br />
            <span className="text-sm">Record a session to generate an AI summary.</span>
          </p>
        </div>
      </div>
    );
  }

  // Transcript is still processing
  if (transcript.status === TranscriptionStatus.Processing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Generating summary...</p>
        </div>
      </div>
    );
  }

  // Display summary
  return (
    <ScrollArea className="h-[400px]">
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <h3 className="text-lg font-semibold mb-4">Session Summary</h3>
        <div className="whitespace-pre-wrap">{transcript.summary}</div>
      </div>
    </ScrollArea>
  );
}
