"use client";

import { FileText, Loader2, Target, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { useTranscript } from "@/lib/api/meeting-recordings";
import { Id } from "@/types/general";
import { TranscriptionStatus, CoachingSummary, parseCoachingSummary } from "@/types/meeting-recording";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SessionSummaryProps {
  coachingSessionId: Id;
}

/**
 * Renders a summary section with icon, title, and list of items.
 */
function SummarySection({
  icon: Icon,
  title,
  items,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
  iconColor: string;
}) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-muted-foreground/50 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Renders a structured coaching summary with sections.
 */
function StructuredSummary({ summary }: { summary: CoachingSummary }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Session Summary</h3>

      <div className="grid gap-4 md:grid-cols-2">
        <SummarySection
          icon={Target}
          title="Goals Discussed"
          items={summary.goals_discussed}
          iconColor="text-blue-500"
        />
        <SummarySection
          icon={TrendingUp}
          title="Progress Made"
          items={summary.progress_made}
          iconColor="text-green-500"
        />
        <SummarySection
          icon={AlertTriangle}
          title="Challenges Identified"
          items={summary.challenges_identified}
          iconColor="text-amber-500"
        />
        <SummarySection
          icon={Lightbulb}
          title="Key Insights"
          items={summary.key_insights}
          iconColor="text-purple-500"
        />
      </div>

      {/* Next Steps gets full width */}
      <SummarySection
        icon={ArrowRight}
        title="Next Steps"
        items={summary.next_steps}
        iconColor="text-primary"
      />
    </div>
  );
}

/**
 * Displays the AI-generated summary for a coaching session.
 * Supports both structured LeMUR summaries and plain text summaries.
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

  // Try to parse as structured summary
  const structuredSummary = parseCoachingSummary(transcript.summary);

  return (
    <ScrollArea className="h-[500px]">
      {structuredSummary ? (
        <StructuredSummary summary={structuredSummary} />
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <h3 className="text-lg font-semibold mb-4">Session Summary</h3>
          <div className="whitespace-pre-wrap">{transcript.summary}</div>
        </div>
      )}
    </ScrollArea>
  );
}
