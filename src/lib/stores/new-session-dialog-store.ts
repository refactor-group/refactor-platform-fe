import type { DateTime } from "ts-luxon";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { MoveScope } from "@/lib/scheduling";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";

export type NewSessionRequest =
  | { kind: "schedule"; date: Option<DateTime> }
  | { kind: "move"; session: EnrichedCoachingSession; scope: MoveScope };

interface NewSessionDialogState {
  /** `id` changes on every open so the dialog remounts with fresh state. */
  open: Option<{ id: number; request: NewSessionRequest }>;
}

interface NewSessionDialogActions {
  openSchedule: (date: Option<DateTime>) => void;
  openMoveSession: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  /** Closes request `id` only, so a late save from an earlier dialog can't close a newer one. */
  close: (id: number) => void;
}

export type NewSessionDialogStore = NewSessionDialogState & NewSessionDialogActions;

export const createNewSessionDialogStore = () => {
  let opens = 0;
  return create<NewSessionDialogStore>()(
    devtools((set, get) => {
      const openWith = (request: NewSessionRequest) => {
        opens += 1;
        set({ open: Some({ id: opens, request }) });
      };
      return {
        open: None,
        openSchedule: (date) => openWith({ kind: "schedule", date }),
        openMoveSession: (session, scope = MoveScope.This) => openWith({ kind: "move", session, scope }),
        close: (id) => {
          const { open } = get();
          if (open.some && open.val.id === id) set({ open: None });
        },
      };
    })
  );
};
