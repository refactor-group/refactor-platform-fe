"use client";

import { cn } from "@/components/lib/utils";
import { TranscriptSegment as TranscriptSegmentType, Sentiment, formatTimestamp } from "@/types/meeting-recording";
import { Badge } from "@/components/ui/badge";

interface TranscriptSegmentProps {
  segment: TranscriptSegmentType;
  className?: string;
}

/**
 * Renders a single transcript segment with speaker label, timestamp, and text.
 * Optionally shows sentiment indicator.
 */
export function TranscriptSegment({ segment, className }: TranscriptSegmentProps) {
  const getSentimentColor = (sentiment: Sentiment | null) => {
    switch (sentiment) {
      case Sentiment.Positive:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case Sentiment.Negative:
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case Sentiment.Neutral:
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className={cn("flex gap-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0", className)}>
      {/* Timestamp column */}
      <div className="flex-shrink-0 w-16 text-xs text-muted-foreground font-mono">
        {formatTimestamp(segment.start_time_ms)}
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Speaker label and sentiment */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-foreground">
            {segment.speaker_label}
          </span>
          {segment.sentiment && (
            <Badge variant="secondary" className={cn("text-xs px-1.5 py-0", getSentimentColor(segment.sentiment))}>
              {segment.sentiment}
            </Badge>
          )}
          {segment.confidence !== null && segment.confidence < 0.8 && (
            <span className="text-xs text-muted-foreground">
              ({Math.round(segment.confidence * 100)}% confidence)
            </span>
          )}
        </div>

        {/* Text content */}
        <p className="text-sm text-foreground leading-relaxed">
          {segment.text}
        </p>
      </div>
    </div>
  );
}
