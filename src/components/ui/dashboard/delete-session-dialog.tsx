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
import { SessionRemoval } from "@/lib/session-actions";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export interface DeleteSessionDialogProps {
  /** The session pending deletion. `undefined` means closed. Driving open
   *  state from this single value (instead of a parallel boolean) prevents
   *  desync between the dialog and the row that triggered it. */
  session: EnrichedCoachingSession | undefined;
  removal: SessionRemoval;
  participantName: string;
  userTimezone: string;
  /** While true, both buttons are disabled and the confirm button reads
   *  "Cancelling…" or "Removing…". The dialog cannot be dismissed via overlay/escape during
   *  this window — closing mid-flight would orphan the API call's UI
   *  effects. */
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

interface RemovalCopy {
  title: string;
  verb: string;
  confirm: string;
  busy: string;
}

function removalCopy(removal: SessionRemoval): RemovalCopy {
  switch (removal) {
    case SessionRemoval.Cancel:
      return {
        title: "Cancel this coaching session?",
        verb: "cancels",
        confirm: "Cancel session",
        busy: "Cancelling…",
      };
    case SessionRemoval.Remove:
      return {
        title: "Remove this coaching session?",
        verb: "removes",
        confirm: "Remove session",
        busy: "Removing…",
      };
    default: {
      const _exhaustive: never = removal;
      throw new Error(`Unhandled removal: ${_exhaustive}`);
    }
  }
}

export function DeleteSessionDialog({
  session,
  removal,
  participantName,
  userTimezone,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteSessionDialogProps) {
  const open = session !== undefined;
  const copy = removalCopy(removal);

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
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            This {copy.verb} the session with{" "}
            <span className="font-medium text-foreground">
              {participantName}
            </span>{" "}
            on{" "}
            <span className="font-medium text-foreground tabular-nums">
              {dateLabel}
            </span>
            , along with its notes and actions. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Don't wire `onCancel` here — `AlertDialogCancel` already
              triggers `onOpenChange(false)`, which in turn calls onCancel.
              A direct `onClick` would double-fire it. */}
          <AlertDialogCancel disabled={isDeleting}>Keep session</AlertDialogCancel>
          <AlertDialogAction
            // `e.preventDefault()` keeps the dialog open across the await
            // boundary so the in-flight label is visible. The
            // parent closes the dialog by clearing `session` once the
            // mutation settles.
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? copy.busy : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
