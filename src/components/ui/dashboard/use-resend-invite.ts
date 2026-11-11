"use client";

import { useCallback, useMemo, useState } from "react";
import { toast as sonnerToast } from "@/lib/toast";
import type { Result } from "neverthrow";
import type { ResendInviteDialogProps } from "@/components/ui/dashboard/resend-invite-dialog";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import { RefusedWrite } from "@/lib/membership-refusal";
import { useMembershipRefusal } from "@/lib/hooks/use-membership-refusal";
import { Some } from "@/types/option";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import {
  ResendInviteRefusal,
  type ResendInviteFailure,
} from "@/types/resend-invite";

type ResendDialogState =
  | { kind: "closed" }
  | { kind: "pending"; session: EnrichedCoachingSession }
  | { kind: "sending"; session: EnrichedCoachingSession };

interface ResendContext {
  session: EnrichedCoachingSession;
  participantName: string;
  isSeries: boolean;
  announceRefusal: ReturnType<typeof useMembershipRefusal>;
}

function resendSessionInvite(ctx: ResendContext) {
  void CoachingSessionApi.resendInvite(ctx.session.id).then((result) =>
    announceResendResult(result, { ...ctx, isSeries: false })
  );
}

function announceResendResult(
  result: Result<void, ResendInviteFailure>,
  ctx: ResendContext
): void {
  if (result.isOk()) {
    sonnerToast.success(`Invite sent to you and ${ctx.participantName}`);
    return;
  }
  const failure = result.error;
  if (failure.kind === "not_a_member") {
    ctx.announceRefusal(failure.error, RefusedWrite.Resend, () => Some(ctx.participantName));
    return;
  }
  const cause = failure.kind === "refused" ? failure.reason : failure.kind;
  switch (cause) {
    case ResendInviteRefusal.LegacySeries:
      sonnerToast.error("This series can't be resent · Resend this session instead", {
        action: {
          label: "Resend this session",
          onClick: () => resendSessionInvite(ctx),
        },
      });
      return;
    case ResendInviteRefusal.NoUpcomingSessions:
      sonnerToast.error(
        ctx.isSeries
          ? "This series has no upcoming sessions"
          : "This session has already happened"
      );
      return;
    case ResendInviteRefusal.SeriesMember:
    case "not_delivered":
    case "network":
    case "unexpected":
      sonnerToast.error("Couldn't resend the invite · Try again in a moment");
      return;
    default: {
      const _exhaustive: never = cause;
      throw new Error(`Unhandled resend failure: ${_exhaustive}`);
    }
  }
}

/** Drives the resend-invite confirmation: open, send once, announce, close. */
export function useResendInvite() {
  const viewerId = useAuthStore((s) => s.userSession?.id);
  const [state, setState] = useState<ResendDialogState>({ kind: "closed" });
  const announceRefusal = useMembershipRefusal();

  const participantName = useMemo(() => {
    if (state.kind === "closed" || !viewerId) return "";
    return getSessionParticipantInfo(state.session, viewerId)?.participantName ?? "Unknown";
  }, [state, viewerId]);

  const requestResend = useCallback(
    (session: EnrichedCoachingSession) => setState({ kind: "pending", session }),
    []
  );

  const onCancel = useCallback(() => setState({ kind: "closed" }), []);

  const onConfirm = useCallback(async () => {
    if (state.kind !== "pending") return;
    const { session } = state;
    setState({ kind: "sending", session });
    const seriesId = session.coaching_session_series_id;
    const result = seriesId.some
      ? await CoachingSessionSeriesApi.resendInvite(seriesId.val)
      : await CoachingSessionApi.resendInvite(session.id);
    announceResendResult(result, { session, participantName, isSeries: seriesId.some, announceRefusal });
    setState({ kind: "closed" });
  }, [state, participantName, announceRefusal]);

  const dialogProps: ResendInviteDialogProps = {
    open: state.kind !== "closed",
    isSeries: state.kind !== "closed" && state.session.coaching_session_series_id.some,
    participantName,
    isSending: state.kind === "sending",
    onCancel,
    onConfirm,
  };

  return { requestResend, dialogProps };
}
