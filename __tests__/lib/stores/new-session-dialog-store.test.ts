import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { createNewSessionDialogStore } from "@/lib/stores/new-session-dialog-store";
import { None, Some } from "@/types/option";

const AUG_20 = DateTime.fromISO("2026-08-20T00:00", { zone: "America/Chicago" });

describe("newSessionDialogStore", () => {
  it("starts closed", () => {
    const store = createNewSessionDialogStore();
    expect(store.getState().open).toEqual(None);
  });

  it("opens a schedule request and closes it", () => {
    const store = createNewSessionDialogStore();
    store.getState().openSchedule(Some(AUG_20));
    const open = store.getState().open;
    expect(open.some && open.val.request).toEqual({ kind: "schedule", date: Some(AUG_20) });
    store.getState().close();
    expect(store.getState().open).toEqual(None);
  });

  it("gives every open a new id, so the dialog remounts fresh", () => {
    const store = createNewSessionDialogStore();
    store.getState().openSchedule(None);
    const first = store.getState().open;
    store.getState().close();
    store.getState().openSchedule(None);
    const second = store.getState().open;
    expect(first.some && second.some && first.val.id !== second.val.id).toBe(true);
  });
});
