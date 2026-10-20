"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ResendInviteDialogProps {
  open: boolean;
  isSeries: boolean;
  participantName: string;
  isSending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResendInviteDialog({
  open,
  isSeries,
  participantName,
  isSending,
  onCancel,
  onConfirm,
}: ResendInviteDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSending) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isSeries ? "Resend series invite?" : "Resend invite?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSeries
              ? `You and ${participantName} will each get a new calendar invite for every session in this series. Accepting it updates your calendars to match.`
              : `You and ${participantName} will each get a new calendar invite for this session.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isSending}
          >
            {isSending ? "Sending…" : "Resend invite"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
