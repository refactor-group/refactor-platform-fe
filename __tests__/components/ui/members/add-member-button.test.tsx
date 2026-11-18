import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddMemberButton } from "@/components/ui/members/add-member-button";
import { AddMemberMode } from "@/lib/add-member-dialog-model";
import { None, Some, type Option } from "@/types/option";
import { Role } from "@/types/user";

vi.mock("@/components/ui/members/add-member-dialog", () => ({
  AddMemberDialog: ({ initialMode, onClose }: { initialMode: AddMemberMode; onClose: () => void }) => (
    <div role="dialog" aria-label={`Add member ${initialMode}`}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

function renderButton(request: Option<AddMemberMode>) {
  const onDialogClose = vi.fn();
  const props = {
    onMemberAdded: vi.fn(),
    onDialogClose,
    currentUserRoleState: { status: "success", role: Role.Admin, hasAccess: true } as const,
    organizationMembers: [],
    relationships: [],
    canAddExistingMembers: true,
  };
  const view = render(<AddMemberButton {...props} openAddMemberDialog={request} />);
  const rerender = (next: Option<AddMemberMode>) =>
    view.rerender(<AddMemberButton {...props} openAddMemberDialog={next} />);
  return { onDialogClose, rerender };
}

describe("AddMemberButton", () => {
  it("opens for each new request, in its mode, even while the page stays put", () => {
    const { rerender, onDialogClose } = renderButton(None);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(Some(AddMemberMode.Existing));
    expect(screen.getByRole("dialog", { name: "Add member existing" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onDialogClose).toHaveBeenCalledTimes(1);

    rerender(Some(AddMemberMode.Existing));
    expect(screen.getByRole("dialog", { name: "Add member existing" })).toBeInTheDocument();
  });

  it("keeps an open dialog open when the request clears", () => {
    const { rerender } = renderButton(Some(AddMemberMode.Existing));
    rerender(None);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("opens in create mode from the button", () => {
    renderButton(None);
    fireEvent.click(screen.getByRole("button", { name: /Add Member/ }));
    expect(screen.getByRole("dialog", { name: "Add member create" })).toBeInTheDocument();
  });
});
