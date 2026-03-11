import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import JoinMeetLink from "@/components/ui/coaching-sessions/join-meet-link";

describe("JoinMeetLink", () => {
  describe("when no meetUrl is provided", () => {
    it("renders a disabled icon button", () => {
      render(<JoinMeetLink />);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("renders a Video icon inside the button", () => {
      render(<JoinMeetLink />);

      const button = screen.getByRole("button");
      const svg = button.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.classList.toString()).toContain("opacity-50");
    });
  });

  describe("when meetUrl is provided", () => {
    const meetUrl = "https://meet.google.com/abc-defg-hij";

    it("renders an enabled link", () => {
      render(<JoinMeetLink meetUrl={meetUrl} />);

      const link = screen.getByRole("link");
      expect(link).not.toBeDisabled();
    });

    it("opens the URL in a new tab", () => {
      render(<JoinMeetLink meetUrl={meetUrl} />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", meetUrl);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders a Video icon inside the link", () => {
      render(<JoinMeetLink meetUrl={meetUrl} />);

      const link = screen.getByRole("link");
      const svg = link.querySelector("svg");
      expect(svg).toBeInTheDocument();
      expect(svg?.classList.toString()).not.toContain("opacity-50");
    });
  });
});
