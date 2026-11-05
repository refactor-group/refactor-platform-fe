"use client";

import { useCallback, useMemo, useState } from "react";
import { toast as sonnerToast } from "@/lib/toast";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { useResendInvite } from "@/components/ui/dashboard/use-resend-invite";
import { useEditSeries } from "@/components/ui/dashboard/use-edit-series";
import type { SeriesAction } from "@/components/ui/dashboard/series-action-dialogs";
import type { SessionActionDialogsProps } from "@/components/ui/dashboard/session-action-dialogs";
import { sessionRemovedMessage } from "@/components/ui/dashboard/session-change-message";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCoachingSessionMutation } from "@/lib/api/coaching-sessions";
import { SessionAction } from "@/lib/session-actions";
import type { MoveScope } from "@/lib/scheduling";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";

/**
 * Models the only legal states of the delete-confirmation flow, so the type
 * system rejects `deleting` with no session.
 */
type DeleteDialogState =
  | { kind: "closed" }
  | { kind: "pending"; session: EnrichedCoachingSession }
  | { kind: "deleting"; session: EnrichedCoachingSession };

export interface UseSessionActionsInput {
  userTimezone: string;
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  onSessionsChanged: () => void;
  onSeriesMutated?: () => void;
}

export interface SessionActions {
  run: (action: SessionAction, session: EnrichedCoachingSession) => void;
  // The row's series callbacks carry only the series id, not the session.
  openSeries: (kind: "view" | "delete", seriesId: Id) => void;
  dialogs: SessionActionDialogsProps;
}

/** Runs a session's menu actions and owns the confirmation dialogs they open. */
export function useSessionActions({
  userTimezone,
  onReschedule,
  onSessionsChanged,
  onSeriesMutated,
}: UseSessionActionsInput): SessionActions {
  const userSession = useAuthStore((s) => s.userSession);
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships } = useCoachingRelationshipList(currentOrganizationId);

  const { delete: deleteSession } = useCoachingSessionMutation();
  const [deleteState, setDeleteState] = useState<DeleteDialogState>({ kind: "closed" });
  const resend = useResendInvite();
  const [seriesAction, setSeriesAction] = useState<SeriesAction>({ kind: "closed" });
  const editSeries = useEditSeries(userTimezone, onReschedule);

  const openSeries = useCallback(
    (kind: "view" | "delete", seriesId: Id) => setSeriesAction({ kind, seriesId }),
    []
  );
  const closeSeriesAction = useCallback(() => setSeriesAction({ kind: "closed" }), []);

  // After a delete the future sessions change, so revalidate this
  // card's buckets and let the parent refresh sibling cards.
  const handleSeriesMutated = useCallback(() => {
    onSessionsChanged();
    onSeriesMutated?.();
  }, [onSessionsChanged, onSeriesMutated]);

  const pendingParticipantName = useMemo(() => {
    if (deleteState.kind === "closed" || !userSession) return "";
    const info = getSessionParticipantInfo(deleteState.session, userSession.id);
    return info?.participantName ?? "Unknown";
  }, [deleteState, userSession]);

  const cancelDelete = useCallback(() => setDeleteState({ kind: "closed" }), []);

  const confirmDelete = useCallback(async () => {
    if (deleteState.kind !== "pending") return;
    const { session } = deleteState;
    setDeleteState({ kind: "deleting", session });
    try {
      await deleteSession(session.id);
      // The user-scoped session caches use tuple keys the mutation's own
      // invalidation misses, so the row only disappears after this revalidate.
      onSessionsChanged();
      setDeleteState({ kind: "closed" });
      sonnerToast.success(sessionRemovedMessage(session, relationships, userTimezone));
    } catch (err) {
      console.error("Failed to delete coaching session:", err);
      sonnerToast.error("Couldn't delete the session · Try again");
      setDeleteState({ kind: "closed" });
    }
  }, [deleteState, deleteSession, onSessionsChanged, relationships, userTimezone]);

  const { requestResend } = resend;
  const run = useCallback(
    (action: SessionAction, session: EnrichedCoachingSession) => {
      const seriesId = session.coaching_session_series_id;
      switch (action) {
        case SessionAction.Reschedule:
          onReschedule(session);
          return;
        case SessionAction.ViewSeries:
          if (seriesId.some) openSeries("view", seriesId.val);
          return;
        case SessionAction.EditSeries:
          editSeries(session);
          return;
        case SessionAction.ShareLink:
          void copyCoachingSessionLinkWithToast(session.id);
          return;
        case SessionAction.ResendInvite:
          requestResend(session);
          return;
        case SessionAction.DeleteSession:
          setDeleteState({ kind: "pending", session });
          return;
        case SessionAction.DeleteSeries:
          if (seriesId.some) openSeries("delete", seriesId.val);
          return;
      }
    },
    [onReschedule, openSeries, editSeries, requestResend]
  );

  return {
    run,
    openSeries,
    dialogs: {
      deleteSession: {
        session: deleteState.kind === "closed" ? undefined : deleteState.session,
        participantName: pendingParticipantName,
        userTimezone,
        isDeleting: deleteState.kind === "deleting",
        onCancel: cancelDelete,
        onConfirm: confirmDelete,
      },
      resendInvite: resend.dialogProps,
      seriesAction: {
        action: seriesAction,
        userTimezone,
        relationships,
        viewerId: userSession?.id,
        onClose: closeSeriesAction,
        onMutated: handleSeriesMutated,
      },
    },
  };
}
