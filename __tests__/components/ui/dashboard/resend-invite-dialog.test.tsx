import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResendInviteDialog } from "@/components/ui/dashboard/resend-invite-dialog";

describe("ResendInviteDialog", () => {
  it("disables both buttons and reads Sending… while sending", () => {
    render(
      <ResendInviteDialog
        open
        isSeries
        participantName="Alex Chen"
        isSending
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });
});
