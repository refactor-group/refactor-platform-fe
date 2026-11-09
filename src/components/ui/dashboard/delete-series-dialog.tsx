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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { CoachingSessionSeries } from "@/types/coaching-session-series";
import type { Option } from "@/types/option";
import { frequencyLabel } from "@/types/recurrence";

export interface DeleteSeriesDialogProps {
  series: Option<CoachingSessionSeries>;
  participantName: Option<string>;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSeriesDialog({
  series,
  participantName,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteSeriesDialogProps) {
  const frequency = series.some
    ? frequencyLabel(series.val.rule.recurrence.frequency).toLowerCase()
    : "";

  return (
    <AlertDialog
      open={series.some}
      onOpenChange={(next) => {
        if (!next && !isDeleting) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this recurring series?</AlertDialogTitle>
          <AlertDialogDescription>
            This cancels the{" "}
            <span className="font-medium text-foreground">{frequency}</span>{" "}
            series
            {participantName.some && (
              <>
                {" "}
                with{" "}
                <span className="font-medium text-foreground">
                  {participantName.val}
                </span>
              </>
            )}{" "}
            from today onward, along with its notes and actions. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Keep series</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? "Cancelling…" : "Cancel series"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
