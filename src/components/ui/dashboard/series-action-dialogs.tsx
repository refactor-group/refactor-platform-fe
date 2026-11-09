"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import type { MenuPerson } from "@/components/ui/join-session/types";
import { DeleteSeriesDialog } from "@/components/ui/dashboard/delete-series-dialog";
import { SeriesDetailDialog } from "@/components/ui/dashboard/series-detail-dialog";
import {
  useCoachingSessionSeries,
  useCoachingSessionSeriesMutation,
} from "@/lib/api/coaching-session-series";
import { otherParticipant } from "@/lib/people";
import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { CoachingSessionSeries } from "@/types/coaching-session-series";
import { Id } from "@/types/general";
import { None, type Option, Some } from "@/types/option";

export type SeriesAction =
  | { kind: "closed" }
  | { kind: "view" | "delete"; seriesId: Id };

export interface SeriesActionDialogsProps {
  action: SeriesAction;
  userTimezone: string;
  relationships: CoachingRelationshipWithUserNames[];
  viewerId: Id | undefined;
  onClose: () => void;
  /** Called after a delete succeeds, so the host can revalidate
   *  affected session lists. */
  onMutated: () => void;
}

/**
 * Drives the view / delete dialogs for a series referenced from a
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
  relationships,
  viewerId,
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
      relationships={relationships}
      viewerId={viewerId}
      onClose={onClose}
      onMutated={onMutated}
    />
  );
}

interface SeriesActionDialogsInnerProps {
  kind: "view" | "delete";
  seriesId: Id;
  userTimezone: string;
  relationships: CoachingRelationshipWithUserNames[];
  viewerId: Id | undefined;
  onClose: () => void;
  onMutated: () => void;
}

function SeriesActionDialogsInner({
  kind,
  seriesId,
  userTimezone,
  relationships,
  viewerId,
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
      toast.error("Couldn't load the series · Try again");
      onClose();
    }
  }, [isError, onClose]);

  // Open the dialogs only once the real series has loaded; until then the hook
  // returns a default with an empty id.
  const loaded: Option<CoachingSessionSeries> =
    !isLoading && series.id === seriesId ? Some(series) : None;

  const relationship = loaded.some
    ? relationships.find((r) => r.id === loaded.val.coaching_relationship_id)
    : undefined;
  const person: Option<MenuPerson> =
    relationship && viewerId ? Some(otherParticipant(relationship, viewerId)) : None;
  const participantName: Option<string> = person.some ? Some(person.val.fullName) : None;

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSeries(seriesId);
      toast.success("Series cancelled · Past sessions were kept");
      onMutated();
      onClose();
    } catch {
      toast.error("Couldn't cancel the series · Try again");
      setIsDeleting(false);
    }
  };

  if (kind === "view") {
    return (
      <SeriesDetailDialog
        series={loaded}
        person={person}
        userTimezone={userTimezone}
        onClose={onClose}
      />
    );
  }

  return (
    <DeleteSeriesDialog
      series={loaded}
      participantName={participantName}
      isDeleting={isDeleting}
      onCancel={onClose}
      onConfirm={handleConfirmDelete}
    />
  );
}
