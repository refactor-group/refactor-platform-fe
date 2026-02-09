import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleDisconnectDialog } from "@/components/ui/settings/google-disconnect-dialog";

describe("GoogleDisconnectDialog", () => {
  const defaultProps = {
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens dialog when Disconnect button is clicked", async () => {
    render(<GoogleDisconnectDialog {...defaultProps} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Disconnect" })
    );

    expect(
      screen.getByText("Disconnect Google Account")
    ).toBeInTheDocument();
  });

  it("shows warning about transcription bot", async () => {
    render(<GoogleDisconnectDialog {...defaultProps} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Disconnect" })
    );

    expect(
      screen.getByText(/prevent the AI transcription bot/)
    ).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    render(<GoogleDisconnectDialog {...defaultProps} />);

    // Open dialog
    await userEvent.click(
      screen.getByRole("button", { name: "Disconnect" })
    );

    // Click the confirm button inside the dialog
    const confirmButton = screen.getAllByRole("button", {
      name: /Disconnect/,
    });
    // The second "Disconnect" button is the confirm action inside the dialog
    await userEvent.click(confirmButton[confirmButton.length - 1]);

    expect(defaultProps.onConfirm).toHaveBeenCalledOnce();
  });

  it("closes dialog without calling onConfirm when Cancel is clicked", async () => {
    render(<GoogleDisconnectDialog {...defaultProps} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Disconnect" })
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cancel" })
    );

    expect(defaultProps.onConfirm).not.toHaveBeenCalled();
  });
});
