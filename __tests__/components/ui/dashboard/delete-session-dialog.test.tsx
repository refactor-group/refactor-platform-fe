import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeleteSessionDialog } from "@/components/ui/dashboard/delete-session-dialog";
import { createMockEnrichedSession } from "../../../test-utils";

// ── Standalone tests for the dialog ──────────────────────────────────────
//
// The card-level integration tests cover the wire-up (which menu fires what,
// which mutation runs on confirm, which toast surfaces on failure). These
// tests pin behavior that's hard to exercise through the card because the
// mutation mock resolves synchronously — primarily the `isDeleting`
// in-flight state and the unified dialog copy.

describe("DeleteSessionDialog", () => {
  function renderDialog(
    overrides: Partial<React.ComponentProps<typeof DeleteSessionDialog>> = {}
  ) {
    const session = createMockEnrichedSession({
      id: "s1",
      date: "2099-03-15T14:00:00Z",
    });
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DeleteSessionDialog
        session={session}
        participantName="Alex Chen"
        userTimezone="UTC"
        isDeleting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
        {...overrides}
      />
    );
    return { onCancel, onConfirm };
  }

  it("does not render the dialog when `session` is undefined", () => {
    render(
      <DeleteSessionDialog
        session={undefined}
        participantName=""
        userTimezone="UTC"
        isDeleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(
      screen.queryByRole("alertdialog", {
        name: /delete this coaching session/i,
      })
    ).not.toBeInTheDocument();
  });

  it("uses the unified copy that names the cascading loss explicitly", () => {
    // The dialog deliberately uses the same copy for upcoming and previous
    // sessions — one mental model, one piece of copy. For upcoming sessions
    // the cascading-loss disclosure is informational (none yet); for
    // previous sessions it's load-bearing. Either way, the user gets a
    // consistent, irreversibility-aware confirmation.
    renderDialog();
    expect(
      screen.getByText(/notes and completed actions/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/can't be undone/i)
    ).toBeInTheDocument();
  });

  it("includes the participant name in the body", () => {
    renderDialog({ participantName: "Bob Belderbos" });
    expect(screen.getByText("Bob Belderbos")).toBeInTheDocument();
  });

  it("invokes onConfirm but keeps the dialog open across the await boundary so isDeleting can render", () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(
      screen.getByRole("button", { name: /^delete session$/i })
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Dialog is still mounted — closing is the parent's responsibility once
    // the mutation settles. Without `e.preventDefault()` in the click
    // handler, AlertDialogAction would close immediately, throwing away the
    // "Deleting…" affordance.
    expect(
      screen.getByRole("alertdialog", {
        name: /delete this coaching session/i,
      })
    ).toBeInTheDocument();
  });

  it("invokes onCancel when Cancel is clicked", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while isDeleting and swaps the confirm label", () => {
    renderDialog({ isDeleting: true });
    const cancel = screen.getByRole("button", { name: /cancel/i });
    const confirm = screen.getByRole("button", { name: /deleting/i });
    expect(cancel).toBeDisabled();
    expect(confirm).toBeDisabled();
    // Sanity: the at-rest confirm copy isn't visible during the in-flight
    // window — it's been replaced by the in-flight label.
    expect(
      screen.queryByRole("button", { name: /^delete session$/i })
    ).not.toBeInTheDocument();
  });
});
