import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { usePathname } from "next/navigation";
import { SettingsNav } from "@/components/ui/settings/settings-nav";

describe("SettingsNav", () => {
  it("renders Integrations parent label and Meetings child link", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/integrations");

    render(<SettingsNav />);

    // Parent category label (not a link) — appears in the desktop nav
    expect(screen.getByText("Integrations")).toBeInTheDocument();

    // Child link — appears in both desktop and mobile
    const meetingsLinks = screen.getAllByRole("link", { name: /Meetings/ });
    expect(meetingsLinks.length).toBeGreaterThan(0);
    meetingsLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", "/settings/integrations");
    });
  });

  it("highlights active child item based on current pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/integrations");

    render(<SettingsNav />);

    const links = screen.getAllByRole("link", { name: /Meetings/ });
    links.forEach((link) => {
      expect(link.className).toContain("bg-accent");
    });
  });

  it("renders both desktop and mobile nav variants", () => {
    vi.mocked(usePathname).mockReturnValue("/settings/integrations");

    render(<SettingsNav />);

    // Should render two nav elements (desktop + mobile)
    const navElements = screen.getAllByRole("navigation");
    expect(navElements).toHaveLength(2);
  });
});
