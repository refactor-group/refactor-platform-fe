"use client";

import {
  DeleteSessionDialog,
  type DeleteSessionDialogProps,
} from "@/components/ui/dashboard/delete-session-dialog";
import {
  ResendInviteDialog,
  type ResendInviteDialogProps,
} from "@/components/ui/dashboard/resend-invite-dialog";
import {
  SeriesActionDialogs,
  type SeriesActionDialogsProps,
} from "@/components/ui/dashboard/series-action-dialogs";

export interface SessionActionDialogsProps {
  deleteSession: DeleteSessionDialogProps;
  resendInvite: ResendInviteDialogProps;
  seriesAction: SeriesActionDialogsProps;
}

export function SessionActionDialogs({
  deleteSession,
  resendInvite,
  seriesAction,
}: SessionActionDialogsProps) {
  return (
    <>
      <DeleteSessionDialog {...deleteSession} />
      <ResendInviteDialog {...resendInvite} />
      <SeriesActionDialogs {...seriesAction} />
    </>
  );
}
