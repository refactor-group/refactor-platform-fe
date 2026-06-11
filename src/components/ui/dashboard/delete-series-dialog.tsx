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
import {
  CoachingSessionSeries,
  formatSeriesRule,
} from "@/types/coaching-session-series";

export interface DeleteSeriesDialogProps {
  series: CoachingSessionSeries | undefined;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteSeriesDialog({
  series,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteSeriesDialogProps) {
  const open = series !== undefined;

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
            This removes the{" "}
            <span className="font-medium text-foreground">
              {series ? formatSeriesRule(series.rule) : ""}
            </span>{" "}
            series and all of its future sessions. Past sessions are kept. This
            can&apos;t be undone.
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
