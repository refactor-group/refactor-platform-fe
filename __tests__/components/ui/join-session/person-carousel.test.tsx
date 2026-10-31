import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PersonCarousel,
  clampPage,
  pageCount,
  pageOf,
} from "@/components/ui/join-session/person-carousel";
import type { MenuPerson } from "@/components/ui/join-session/types";

const people: MenuPerson[] = Array.from({ length: 7 }, (_, i) => ({
  userId: `u${i + 1}`,
  firstName: `Name${i + 1}`,
  fullName: `Name${i + 1} Last`,
  initials: `N${i + 1}`,
}));

function renderCarousel(page: number, selectedId = "u2") {
  const onPageChange = vi.fn();
  const onSelect = vi.fn();
  render(
    <PersonCarousel
      people={people}
      selectedId={selectedId}
      page={page}
      onPageChange={onPageChange}
      onSelect={onSelect}
    />
  );
  return { onPageChange, onSelect };
}

const card = (name: string) => screen.getByText(name).closest("button")!;

describe("PersonCarousel", () => {
  it("makes off-page people inert on the first page", () => {
    renderCarousel(0);
    expect(card("Name6")).toHaveAttribute("inert");
    expect(card("Name7")).toHaveAttribute("inert");
    expect(card("Name5")).not.toHaveAttribute("inert");
  });

  it("disables prev on the first page and pages forward", () => {
    const { onPageChange } = renderCarousel(0);
    expect(screen.getByRole("button", { name: "Previous people" })).toBeDisabled();
    const next = screen.getByRole("button", { name: "Next people" });
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables next on the last page", () => {
    renderCarousel(1);
    expect(screen.getByRole("button", { name: "Next people" })).toBeDisabled();
    expect(card("Name1")).toHaveAttribute("inert");
  });

  it("marks the selected person pressed and selects on click", () => {
    const { onSelect } = renderCarousel(0, "u2");
    expect(card("Name2")).toHaveAttribute("aria-pressed", "true");
    expect(card("Name3")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(card("Name3"));
    expect(onSelect).toHaveBeenCalledWith("u3");
  });
});

describe("paging helpers", () => {
  it("counts pages", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(5)).toBe(1);
    expect(pageCount(6)).toBe(2);
  });

  it("clamps pages", () => {
    expect(clampPage(5, 7)).toBe(1);
    expect(clampPage(-1, 7)).toBe(0);
  });

  it("finds a person's page", () => {
    expect(pageOf("u6", people)).toBe(1);
    expect(pageOf("missing", people)).toBe(0);
  });
});
