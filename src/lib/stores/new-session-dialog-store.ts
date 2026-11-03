import type { DateTime } from "ts-luxon";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { type Option, None, Some } from "@/types/option";

export type NewSessionRequest = { kind: "schedule"; date: Option<DateTime> };

interface NewSessionDialogState {
  /** `id` changes on every open so the dialog remounts with fresh state. */
  open: Option<{ id: number; request: NewSessionRequest }>;
}

interface NewSessionDialogActions {
  openSchedule: (date: Option<DateTime>) => void;
  close: () => void;
}

export type NewSessionDialogStore = NewSessionDialogState & NewSessionDialogActions;

export const createNewSessionDialogStore = () => {
  let opens = 0;
  return create<NewSessionDialogStore>()(
    devtools((set) => ({
      open: None,
      openSchedule: (date) => {
        opens += 1;
        set({ open: Some({ id: opens, request: { kind: "schedule", date } }) });
      },
      close: () => set({ open: None }),
    }))
  );
};
