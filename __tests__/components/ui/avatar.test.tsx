import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  OrgAvatar,
  PersonAvatar,
  type PersonAvatarSize,
} from "@/components/ui/avatar";
import { avatarToneFor } from "@/lib/avatar-palette";

function toneClass(el: HTMLElement): string | undefined {
  return Array.from(el.classList).find((c) => /^bg-avatar-\d$/.test(c));
}

function rootOf(initials: string): HTMLElement {
  const root = screen.getByText(initials).parentElement;
  if (!root) throw new Error("avatar root missing");
  return root;
}

describe("PersonAvatar", () => {
  it("renders its initials", () => {
    render(<PersonAvatar userId="user-1" initials="JH" size={36} />);
    expect(screen.getByText("JH")).toBeInTheDocument();
  });

  it("picks a stable tone from the user id", () => {
    const userId = "3f2b6c1e-0000-4000-8000-000000000000";
    render(
      <>
        <PersonAvatar userId={userId} initials="AA" size={36} />
        <PersonAvatar userId={userId} initials="BB" size={36} />
      </>
    );
    const first = toneClass(screen.getByText("AA"));
    expect(first).toBe(`bg-avatar-${avatarToneFor(userId)}`);
    expect(toneClass(screen.getByText("BB"))).toBe(first);
  });

  it("marks the selected avatar with a ring", () => {
    render(
      <>
        <PersonAvatar userId="u1" initials="SE" size={36} selected />
        <PersonAvatar userId="u2" initials="UN" size={36} />
      </>
    );
    const selected = rootOf("SE");
    expect(selected).toHaveAttribute("data-selected", "true");
    expect(selected).toHaveClass("ring-primary");
    const unselected = rootOf("UN");
    expect(unselected).toHaveAttribute("data-selected", "false");
    expect(unselected).not.toHaveClass("ring-primary");
  });

  it.each<[PersonAvatarSize, string]>([
    [26, "h-[26px]"],
    [28, "h-7"],
    [36, "h-9"],
    [40, "h-10"],
  ])("renders size %i with %s", (size, heightClass) => {
    render(<PersonAvatar userId="u1" initials="SZ" size={size} />);
    expect(rootOf("SZ")).toHaveClass(heightClass);
  });
});

describe("OrgAvatar", () => {
  it("renders square initials when there is no logo", () => {
    render(<OrgAvatar name="Refactor Group" logo={undefined} />);
    expect(screen.getByText("RG")).toBeInTheDocument();
    expect(rootOf("RG")).toHaveClass("rounded-lg");
  });
});
