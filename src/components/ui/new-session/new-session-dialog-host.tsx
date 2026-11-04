"use client";

import { NewSessionDialog } from "@/components/ui/new-session/new-session-dialog";
import { useNewSessionDialogStore } from "@/lib/providers/new-session-dialog-store-provider";

export function NewSessionDialogHost() {
  const open = useNewSessionDialogStore((state) => state.open);
  const close = useNewSessionDialogStore((state) => state.close);
  if (open.none) return null;
  return <NewSessionDialog key={open.val.id} request={open.val.request} onClose={close} />;
}
