"use client";

import { DateTime } from "ts-luxon";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { formatDateWithTime } from "@/lib/utils/date";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export interface DeleteSessionDialogProps {
  /** The session pending deletion. `undefined` means closed. Driving open
   *  state from this single value (instead of a parallel boolean) prevents
   *  desync between the dialog and the row that triggered it. */
  session: EnrichedCoachingSession | undefined;
  participantName: string;
  userTimezone: string;
  /** While true, both buttons are disabled and the confirm button reads
   *  "Deleting…". The dialog cannot be dismissed via overlay/escape during
   *  this window — closing mid-flight would orphan the API call's UI
   *  effects. */
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSessionDialog({
  session,
  participantName,
  userTimezone,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteSessionDialogProps) {
  const open = session !== undefined;

  const dateLabel = session
    ? formatDateWithTime(
        DateTime.fromISO(session.date, { zone: "utc" }).setZone(userTimezone),
        "·"
      )
    : "";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Only honor close transitions, and only when not in-flight. Open is
        // driven exclusively by `session !== undefined`.
        if (!next && !isDeleting) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this coaching session?</AlertDialogTitle>
          <AlertDialogDescription>
            {/* Unified copy across both tabs. We always disclose the
                cascading loss (notes, completed actions) — for upcoming
                sessions this is harmlessly informational since none have
                accumulated yet, and the consistency keeps the friction
                appropriate to the irreversibility of the action. */}
            This will permanently remove the session with{" "}
            <span className="font-medium text-foreground">
              {participantName}
            </span>{" "}
            on{" "}
            <span className="font-medium text-foreground tabular-nums">
              {dateLabel}
            </span>
            , along with all of its notes and completed actions. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Don't wire `onCancel` here — `AlertDialogCancel` already
              triggers `onOpenChange(false)`, which in turn calls onCancel.
              A direct `onClick` would double-fire it. */}
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            // `e.preventDefault()` keeps the dialog open across the await
            // boundary so the in-flight "Deleting…" label is visible. The
            // parent closes the dialog by clearing `session` once the
            // mutation settles.
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? "Deleting…" : "Delete session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
