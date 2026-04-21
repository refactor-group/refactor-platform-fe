"use client";

import type { FC } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ZoomDisconnectDialogProps {
  onConfirm: () => void;
  isLoading?: boolean;
}

export const ZoomDisconnectDialog: FC<ZoomDisconnectDialogProps> = ({
  onConfirm,
  isLoading = false,
}) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isLoading}>
          Disconnect
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disconnect Zoom Account</AlertDialogTitle>
          <AlertDialogDescription>
            Disconnecting your Zoom account will prevent the AI transcription
            bot from joining your coaching sessions. You can reconnect at any
            time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Disconnecting..." : "Disconnect"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
