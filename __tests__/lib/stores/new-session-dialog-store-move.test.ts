import { describe, expect, it } from "vitest";
import { MoveScope } from "@/lib/scheduling";
import { createNewSessionDialogStore } from "@/lib/stores/new-session-dialog-store";
import { E_18 } from "../scheduling/roster";

describe("newSessionDialogStore: move", () => {
  it("opens a move request for a session, this session only by default", () => {
    const store = createNewSessionDialogStore();
    store.getState().openMoveSession(E_18);
    const open = store.getState().open;
    expect(open.some && open.val.request).toEqual({ kind: "move", session: E_18, scope: MoveScope.This });
  });

  it("opens with this and following preselected", () => {
    const store = createNewSessionDialogStore();
    store.getState().openMoveSession(E_18, MoveScope.Following);
    const open = store.getState().open;
    expect(open.some && open.val.request).toEqual({ kind: "move", session: E_18, scope: MoveScope.Following });
  });

  it("gives a move a new id too", () => {
    const store = createNewSessionDialogStore();
    store.getState().openMoveSession(E_18);
    const first = store.getState().open;
    store.getState().openMoveSession(E_18);
    const second = store.getState().open;
    expect(first.some && second.some && first.val.id !== second.val.id).toBe(true);
  });
});
