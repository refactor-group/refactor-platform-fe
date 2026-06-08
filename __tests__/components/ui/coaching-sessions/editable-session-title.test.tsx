// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 2b contract for the editable session Title heading (Option A):
// the presentational <EditableSessionTitle> — display (title vs muted
// fallback), click-to-edit, and the three-state save callback. Data wiring
// (hooks -> props, save -> CoachingSessionApi.update, the participant subtitle)
// lives in the parent CoachingSessionTitle and is covered by a separate
// non-frozen test; this file pins the reusable presentational behavior.
//
// Read-only (chmod 0444), on the freeze list: an IMPLEMENTER must NOT edit it.
// Only the overseer may unlock it for a genuine spec/harness error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Some, None } from "@/types/option";
import { EditableSessionTitle } from "@/components/ui/coaching-sessions/editable-session-title";

describe("EditableSessionTitle — display", () => {
  it("shows the human title when set, with an 'Edit title' affordance", () => {
    render(
      <EditableSessionTitle
        title={Some("Quarterly planning")}
        fallbackTitle="Improve leadership"
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Quarterly planning")).toBeInTheDocument();
    // The fallback must NOT be shown when a real title is set.
    expect(screen.queryByText("Improve leadership")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /edit title/i })
    ).toBeInTheDocument();
  });

  it("shows the fallback (muted) with an 'Add a title' affordance when unset", () => {
    render(
      <EditableSessionTitle
        title={None}
        fallbackTitle="Improve leadership"
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Improve leadership")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add a title/i })
    ).toBeInTheDocument();
  });
});

describe("EditableSessionTitle — click to edit", () => {
  it("enters edit mode pre-filled with the current title", () => {
    render(
      <EditableSessionTitle
        title={Some("Quarterly planning")}
        fallbackTitle="Improve leadership"
        onSave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /edit title/i }));
    const input = screen.getByRole("textbox", { name: /session title/i });
    expect((input as HTMLInputElement).value).toBe("Quarterly planning");
  });

  it("enters edit mode with an empty field when there is no title", () => {
    render(
      <EditableSessionTitle
        title={None}
        fallbackTitle="Improve leadership"
        onSave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /add a title/i }));
    const input = screen.getByRole("textbox", { name: /session title/i });
    expect((input as HTMLInputElement).value).toBe("");
  });
});

describe("EditableSessionTitle — save semantics (trimmed; '' clears)", () => {
  beforeEach(() => vi.clearAllMocks());

  const openEditor = (title: ReturnType<typeof Some<string>> | typeof None) => {
    const onSave = vi.fn();
    render(
      <EditableSessionTitle title={title} fallbackTitle="Fallback" onSave={onSave} />
    );
    const trigger = screen.getByRole("button", { name: /(edit|add a) title/i });
    fireEvent.click(trigger);
    return { onSave, input: screen.getByRole("textbox", { name: /session title/i }) };
  };

  it("commits a new trimmed title on Enter", () => {
    const { onSave, input } = openEditor(Some("Old title"));
    fireEvent.change(input, { target: { value: "  New plan  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("New plan");
  });

  it("commits an empty string (clear) when the field is emptied", () => {
    const { onSave, input } = openEditor(Some("Old title"));
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("");
  });

  it("does NOT save on Escape and restores the original heading", () => {
    const { onSave, input } = openEditor(Some("Old title"));
    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Old title")).toBeInTheDocument();
  });

  it("does NOT save when the title is committed unchanged (no spurious write)", () => {
    const { onSave, input } = openEditor(Some("Old title"));
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
  });
});
