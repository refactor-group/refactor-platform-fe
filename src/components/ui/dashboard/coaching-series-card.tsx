"use client";

import { useState } from "react";
import { CalendarClock, CalendarRange, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { DeleteSeriesDialog } from "@/components/ui/dashboard/delete-series-dialog";
import { RescheduleSeriesDialog } from "@/components/ui/dashboard/reschedule-series-dialog";
import { SeriesDetailDialog } from "@/components/ui/dashboard/series-detail-dialog";
import {
  useCoachingSessionSeriesList,
  useCoachingSessionSeriesMutation,
} from "@/lib/api/coaching-session-series";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  CoachingSessionSeries,
  formatSeriesRule,
} from "@/types/coaching-session-series";
import { Id } from "@/types/general";

interface CoachingSeriesCardProps {
  relationshipId: Id | null;
  canManage?: boolean;
  onSeriesMutated?: () => void;
}

type DeleteState =
  | { kind: "closed" }
  | { kind: "pending"; series: CoachingSessionSeries }
  | { kind: "deleting"; series: CoachingSessionSeries };

/**
 * Lists the recurring-session series for the selected coaching relationship
 * and lets coaches delete one. Metadata only — the per-series sessions live
 * behind the detail endpoint.
 */
export function CoachingSeriesCard({
  relationshipId,
  canManage = false,
  onSeriesMutated,
}: CoachingSeriesCardProps) {
  const { series, isLoading, isError, refresh } =
    useCoachingSessionSeriesList(relationshipId);
  const { delete: deleteSeries } = useCoachingSessionSeriesMutation();
  const [deleteState, setDeleteState] = useState<DeleteState>({
    kind: "closed",
  });
  const [detailSeries, setDetailSeries] = useState<CoachingSessionSeries | null>(
    null
  );
  const [rescheduleSeries, setRescheduleSeries] =
    useState<CoachingSessionSeries | null>(null);
  const userTimezone = getBrowserTimezone();

  const handleConfirmDelete = async () => {
    if (deleteState.kind !== "pending") return;
    const target = deleteState.series;
    setDeleteState({ kind: "deleting", series: target });
    try {
      await deleteSeries(target.id);
      toast.success(
        "Recurring series deleted. Future sessions were removed; past sessions were kept."
      );
      setDeleteState({ kind: "closed" });
      // The series list uses a tuple SWR key the mutation hook can't
      // auto-invalidate, and deleting drops future sessions — refresh both.
      refresh();
      onSeriesMutated?.();
    } catch {
      toast.error("Couldn't delete the recurring series. Please try again.");
      setDeleteState({ kind: "pending", series: target });
    }
  };

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
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 py-3 first:pt-0"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium truncate">
                    {formatSeriesRule(s.rule)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {s.rule.duration_minutes}-minute sessions
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Series actions"
                      className="rounded-full h-8 w-8 shrink-0 text-muted-foreground/60 hover:text-foreground"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setDetailSeries(s)}>
                      <CalendarRange className="mr-2 h-4 w-4" />
                      View sessions
                    </DropdownMenuItem>
                    {canManage && (
                      <DropdownMenuItem onClick={() => setRescheduleSeries(s)}>
                        <CalendarClock className="mr-2 h-4 w-4" />
                        Reschedule
                      </DropdownMenuItem>
                    )}
                    {canManage && <DropdownMenuSeparator />}
                    {canManage && (
                      <DropdownMenuItem
                        onClick={() =>
                          setDeleteState({ kind: "pending", series: s })
                        }
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete series
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DeleteSeriesDialog
        series={
          deleteState.kind === "closed" ? undefined : deleteState.series
        }
        isDeleting={deleteState.kind === "deleting"}
        onCancel={() => setDeleteState({ kind: "closed" })}
        onConfirm={handleConfirmDelete}
      />

      <SeriesDetailDialog
        series={detailSeries}
        userTimezone={userTimezone}
        onClose={() => setDetailSeries(null)}
      />

      <RescheduleSeriesDialog
        series={rescheduleSeries}
        onClose={() => setRescheduleSeries(null)}
        onRescheduled={() => {
          refresh();
          onSeriesMutated?.();
        }}
      />
    </Card>
  );
}
