import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeleteSessionDialog } from "@/components/ui/dashboard/delete-session-dialog";
import { SessionRemoval } from "@/lib/session-actions";
import { createMockEnrichedSession } from "../../../test-utils";

function renderDialog(overrides: Partial<React.ComponentProps<typeof DeleteSessionDialog>> = {}) {
  const props = {
    session: createMockEnrichedSession({ id: "s1", date: "2099-03-15T14:00:00Z" }),
    removal: SessionRemoval.Cancel,
    participantName: "Alex Chen",
    userTimezone: "UTC",
    isDeleting: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<DeleteSessionDialog {...props} />);
  return props;
}

describe("DeleteSessionDialog", () => {
  it("renders nothing when no session is pending", () => {
    renderDialog({ session: undefined });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks to cancel an upcoming session, with Keep session as the way out", () => {
    renderDialog();
    const dialog = screen.getByRole("alertdialog", { name: "Cancel this coaching session?" });
    expect(dialog).toHaveTextContent("Alex Chen");
    expect(dialog).toHaveTextContent(/notes and actions/);
    expect(dialog).toHaveTextContent("can't be undone");
    expect(screen.getByRole("button", { name: "Cancel session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep session" })).toBeInTheDocument();
  });

  it("asks to remove a past session", () => {
    renderDialog({ removal: SessionRemoval.Remove });
    const dialog = screen.getByRole("alertdialog", { name: "Remove this coaching session?" });
    expect(dialog).toHaveTextContent(/notes and actions/);
    expect(screen.getByRole("button", { name: "Remove session" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep session" })).toBeInTheDocument();
  });

  it.each([SessionRemoval.Cancel, SessionRemoval.Remove])("never says Delete (%s)", (removal) => {
    renderDialog({ removal });
    expect(screen.getByRole("alertdialog")).not.toHaveTextContent(/delet/i);
  });

  it("confirms without closing, so the in-flight label can show", () => {
    const { onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("Keep session calls onCancel once", () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Keep session" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each([
    [SessionRemoval.Cancel, "Cancelling…"],
    [SessionRemoval.Remove, "Removing…"],
  ])("disables both buttons while in flight (%s)", (removal, busy) => {
    renderDialog({ removal, isDeleting: true });
    expect(screen.getByRole("button", { name: "Keep session" })).toBeDisabled();
    expect(screen.getByRole("button", { name: busy })).toBeDisabled();
  });
});
