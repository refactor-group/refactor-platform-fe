import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MeetUrlField } from "@/components/ui/settings/meet-url-field";

describe("MeetUrlField", () => {
  const defaultProps = {
    isGoogleOAuthConnected: true,
    onCreate: vi.fn().mockResolvedValue(undefined),
    onRemove: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when no meet_url is set", () => {
    it("shows Create Meet button", () => {
      render(<MeetUrlField {...defaultProps} />);

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

    it("enables Create Meet button when Google OAuth is connected", () => {
      render(<MeetUrlField {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Create Meet" })
      ).not.toBeDisabled();
    });

    it("calls onCreate when Create Meet button is clicked", async () => {
      render(<MeetUrlField {...defaultProps} />);

      await userEvent.click(screen.getByRole("button", { name: "Create Meet" }));

      expect(defaultProps.onCreate).toHaveBeenCalled();
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
