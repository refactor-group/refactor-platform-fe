"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DeleteSeriesDialog } from "@/components/ui/dashboard/delete-series-dialog";
import { RescheduleSeriesDialog } from "@/components/ui/dashboard/reschedule-series-dialog";
import { SeriesDetailDialog } from "@/components/ui/dashboard/series-detail-dialog";
import {
  useCoachingSessionSeries,
  useCoachingSessionSeriesMutation,
} from "@/lib/api/coaching-session-series";
import { Id } from "@/types/general";

export type SeriesAction =
  | { kind: "closed" }
  | { kind: "view" | "edit" | "delete"; seriesId: Id };

export interface SeriesActionDialogsProps {
  action: SeriesAction;
  userTimezone: string;
  onClose: () => void;
  /** Called after a reschedule or delete succeeds, so the host can revalidate
   *  affected session lists. */
  onMutated: () => void;
}

/**
 * Drives the view / edit / delete dialogs for a series referenced from a
 * session row's kebab. The row only carries the `coaching_session_series_id`,
 * so the fetching inner component resolves the full series by id.
 *
 * Mounting the inner only while an action is active means the fetch hook always
 * receives a real id rather than an empty-string sentinel. The trade-off is
 * that closing unmounts immediately (no exit animation), which is acceptable
 * for these infrequent, confirmation-style dialogs.
 */
export function SeriesActionDialogs({
  action,
  userTimezone,
  onClose,
  onMutated,
}: SeriesActionDialogsProps) {
  if (action.kind === "closed") return null;
  return (
    <SeriesActionDialogsInner
      key={action.seriesId}
      kind={action.kind}
      seriesId={action.seriesId}
      userTimezone={userTimezone}
      onClose={onClose}
      onMutated={onMutated}
    />
  );
}

interface SeriesActionDialogsInnerProps {
  kind: "view" | "edit" | "delete";
  seriesId: Id;
  userTimezone: string;
  onClose: () => void;
  onMutated: () => void;
}

function SeriesActionDialogsInner({
  kind,
  seriesId,
  userTimezone,
  onClose,
  onMutated,
}: SeriesActionDialogsInnerProps) {
  const { series, isLoading, isError } = useCoachingSessionSeries(
    seriesId,
    userTimezone
  );
  const { delete: deleteSeries } =
    useCoachingSessionSeriesMutation(userTimezone);
  const [isDeleting, setIsDeleting] = useState(false);

  // Surface a fetch failure and bail rather than leaving the kebab seemingly
  // unresponsive — the dialogs below would otherwise never open (the hook
  // returns a default series with an empty id on error).
  useEffect(() => {
    if (isError) {
      toast.error("Couldn't load the recurring series. Please try again.");
      onClose();
    }
  }, [isError, onClose]);

  // Open the dialogs only once the real series has loaded; until then the hook
  // returns a default with an empty id.
  const loaded = !isLoading && series.id === seriesId ? series : null;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSeries(seriesId);
      toast.success(
        "Recurring series deleted. Future sessions were removed; past sessions were kept."
      );
      onMutated();
      onClose();
    } catch {
      toast.error("Couldn't delete the recurring series. Please try again.");
      setIsDeleting(false);
    }
  };

  if (kind === "view") {
    return (
      <SeriesDetailDialog
        series={loaded}
        userTimezone={userTimezone}
        onClose={onClose}
      />
    );
  }

  if (kind === "edit") {
    return (
      <RescheduleSeriesDialog
        series={loaded}
        onClose={onClose}
        onRescheduled={onMutated}
      />
    );
  }

  return (
    <DeleteSeriesDialog
      series={loaded ?? undefined}
      isDeleting={isDeleting}
      onCancel={onClose}
      onConfirm={handleConfirmDelete}
    />
  );
}
