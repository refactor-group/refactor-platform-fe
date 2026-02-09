import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MeetUrlField } from "@/components/ui/settings/meet-url-field";

describe("MeetUrlField", () => {
  const defaultProps = {
    isGoogleOAuthConnected: true,
    onUpdate: vi.fn().mockResolvedValue(undefined),
    onCreate: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when no meet_url is set", () => {
    it("shows text input and Create Meet button", () => {
      render(<MeetUrlField {...defaultProps} />);

      expect(
        screen.getByPlaceholderText("Paste Google Meet URL")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Create Meet" })
      ).toBeInTheDocument();
    });

    it("disables Create Meet button when Google OAuth is not connected", () => {
      render(
        <MeetUrlField {...defaultProps} isGoogleOAuthConnected={false} />
      );

      expect(
        screen.getByRole("button", { name: "Create Meet" })
      ).toBeDisabled();
    });

    it("shows validation error for invalid URL on blur", async () => {
      render(<MeetUrlField {...defaultProps} />);

      const input = screen.getByPlaceholderText("Paste Google Meet URL");
      await userEvent.type(input, "https://not-a-meet-url.com");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText(/Please enter a valid Google Meet URL/)
        ).toBeInTheDocument();
      });
    });

    it("calls onUpdate with valid URL on blur", async () => {
      render(<MeetUrlField {...defaultProps} />);

      const validUrl = "https://meet.google.com/abc-defg-hij";
      const input = screen.getByPlaceholderText("Paste Google Meet URL");
      await userEvent.type(input, validUrl);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalledWith(validUrl);
      });
    });
  });

  describe("when meet_url is set", () => {
    const meetUrl = "https://meet.google.com/abc-defg-hij";

    it("shows readonly input with URL", () => {
      render(<MeetUrlField {...defaultProps} meetUrl={meetUrl} />);

      const input = screen.getByDisplayValue(meetUrl);
      expect(input).toHaveAttribute("readOnly");
    });

    it("shows copy and remove buttons, and an external link", () => {
      render(<MeetUrlField {...defaultProps} meetUrl={meetUrl} />);

      // Copy and Remove are buttons; external link renders as <a> via asChild
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(2);

      const externalLink = screen.getByRole("link");
      expect(externalLink).toHaveAttribute("href", meetUrl);
      expect(externalLink).toHaveAttribute("target", "_blank");
    });

    it("calls onRemove when remove button is clicked", async () => {
      render(<MeetUrlField {...defaultProps} meetUrl={meetUrl} />);

      // The remove button is the last button (X icon)
      const buttons = screen.getAllByRole("button");
      await userEvent.click(buttons[buttons.length - 1]);

      expect(defaultProps.onRemove).toHaveBeenCalled();
    });
  });
});
