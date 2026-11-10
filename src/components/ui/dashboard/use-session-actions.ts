"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "ts-luxon";
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
import { SessionAction, SessionRemoval, sessionRemovalFor } from "@/lib/session-actions";
import type { MoveScope } from "@/lib/scheduling";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import { sessionLocked } from "@/lib/week-grid/card";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

/**
 * Models the only legal states of the delete-confirmation flow, so the type
 * system rejects `deleting` with no session.
 */
type DeleteDialogState =
  | { kind: "closed" }
  | { kind: "pending"; session: EnrichedCoachingSession; removal: SessionRemoval }
  | { kind: "deleting"; session: EnrichedCoachingSession; removal: SessionRemoval };

export interface UseSessionActionsInput {
  userTimezone: string;
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  onMove: (session: EnrichedCoachingSession) => void;
  onSessionsChanged: () => void;
  onSeriesMutated?: () => void;
}

export interface SessionActions {
  run: (action: SessionAction, session: EnrichedCoachingSession) => void;
  dialogs: SessionActionDialogsProps;
}

function removalFailedMessage(removal: SessionRemoval): string {
  switch (removal) {
    case SessionRemoval.Cancel:
      return "Couldn't cancel the session · Try again";
    case SessionRemoval.Remove:
      return "Couldn't remove the session · Try again";
    default: {
      const _exhaustive: never = removal;
      throw new Error(`Unhandled removal: ${_exhaustive}`);
    }
  }
}

/** Runs a session's menu actions and owns the confirmation dialogs they open. */
export function useSessionActions({
  userTimezone,
  onReschedule,
  onMove,
  onSessionsChanged,
  onSeriesMutated,
}: UseSessionActionsInput): SessionActions {
  const router = useRouter();
  const userSession = useAuthStore((s) => s.userSession);
  const { currentOrganizationId } = useCurrentOrganization();
  const { relationships } = useCoachingRelationshipList(currentOrganizationId);

  const { delete: deleteSession } = useCoachingSessionMutation();
  const [deleteState, setDeleteState] = useState<DeleteDialogState>({ kind: "closed" });
  const resend = useResendInvite();
  const [seriesAction, setSeriesAction] = useState<SeriesAction>({ kind: "closed" });
  const editSeries = useEditSeries(userTimezone, onReschedule);

  const closeSeriesAction = useCallback(() => setSeriesAction({ kind: "closed" }), []);

  // A series change moves future sessions, so sibling cards refresh too.
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
    const { session, removal } = deleteState;
    setDeleteState({ kind: "deleting", session, removal });
    try {
      await deleteSession(session.id);
      // The mutation's own invalidation misses the user-scoped session caches.
      onSessionsChanged();
      setDeleteState({ kind: "closed" });
      sonnerToast.success(sessionRemovedMessage(session, relationships, userTimezone, removal));
    } catch (err) {
      console.error("Failed to delete coaching session:", err);
      sonnerToast.error(removalFailedMessage(removal));
      setDeleteState({ kind: "closed" });
    }
  }, [deleteState, deleteSession, onSessionsChanged, relationships, userTimezone]);

  const { requestResend } = resend;
  const run = useCallback(
    (action: SessionAction, session: EnrichedCoachingSession) => {
      const seriesId = session.coaching_session_series_id;
      switch (action) {
        case SessionAction.OpenSession:
          router.push(`/coaching-sessions/${session.id}`);
          return;
        case SessionAction.Reschedule:
          onReschedule(session);
          return;
        case SessionAction.Move:
          onMove(session);
          return;
        case SessionAction.ViewSeries:
          if (seriesId.some) setSeriesAction({ kind: "view", seriesId: seriesId.val });
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
          setDeleteState({
            kind: "pending",
            session,
            removal: sessionRemovalFor(sessionLocked(session, DateTime.now(), userTimezone)),
          });
          return;
        case SessionAction.DeleteSeries:
          if (seriesId.some) setSeriesAction({ kind: "delete", seriesId: seriesId.val });
          return;
        default: {
          const _exhaustive: never = action;
          throw new Error(`Unhandled action: ${_exhaustive}`);
        }
      }
    },
    [router, onReschedule, onMove, editSeries, requestResend, userTimezone]
  );

  return {
    run,
    dialogs: {
      deleteSession: {
        session: deleteState.kind === "closed" ? undefined : deleteState.session,
        removal: deleteState.kind === "closed" ? SessionRemoval.Cancel : deleteState.removal,
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
