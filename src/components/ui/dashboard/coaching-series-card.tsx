"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useCoachingSessionSeriesList } from "@/lib/api/coaching-session-series";
import { formatSeriesRule } from "@/types/coaching-session-series";
import { Id } from "@/types/general";

interface CoachingSeriesCardProps {
  /** Relationship whose series to list; null shows a "select a relationship" prompt. */
  relationshipId: Id | null;
}

/**
 * Lists the recurring-session series for the selected coaching relationship.
 * Metadata only — the per-series sessions live behind the detail endpoint.
 */
export function CoachingSeriesCard({ relationshipId }: CoachingSeriesCardProps) {
  const { series, isLoading, isError } =
    useCoachingSessionSeriesList(relationshipId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recurring sessions</CardTitle>
        <CardDescription>
          Recurrence schedules for the selected coaching relationship.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!relationshipId ? (
          <p className="text-sm text-muted-foreground">
            Select a coaching relationship to see its recurring sessions.
          </p>
        ) : isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Loading recurring sessions…
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t load recurring sessions. Please try again.
          </p>
        ) : series.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recurring sessions for this relationship.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {series.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5 py-3 first:pt-0">
                <span className="font-medium">{formatSeriesRule(s.rule)}</span>
                <span className="text-sm text-muted-foreground">
                  {s.rule.duration_minutes}-minute sessions
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
