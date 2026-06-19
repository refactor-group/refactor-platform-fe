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
import { frequencyLabel } from "@/types/recurrence";

export interface DeleteSeriesDialogProps {
  series: CoachingSessionSeries | undefined;
  participantName: string;
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
  const open = series !== undefined;
  const frequency = series
    ? frequencyLabel(series.rule.recurrence.frequency).toLowerCase()
    : "";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isDeleting) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this recurring series?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the{" "}
            <span className="font-medium text-foreground">{frequency}</span>{" "}
            series
            {participantName && (
              <>
                {" "}
                with{" "}
                <span className="font-medium text-foreground">
                  {participantName}
                </span>
              </>
            )}{" "}
            from today onward, along with all of its notes and completed
            actions. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isDeleting}
            className={cn(buttonVariants({ variant: "destructive" }))}
          >
            {isDeleting ? "Deleting…" : "Delete series"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
