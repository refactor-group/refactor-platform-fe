import { fireEvent, render, screen } from "@testing-library/react";
import { None, Some } from "@/types/option";
import { describe, expect, it, vi } from "vitest";
import {
  PersonCarousel,
  cardCount,
  clampPage,
  pageCount,
  pageOf,
} from "@/components/ui/join-session/person-carousel";
import type { CarouselPerson } from "@/components/ui/join-session/types";

const people: CarouselPerson[] = Array.from({ length: 7 }, (_, i) => ({
  person: {
    userId: `u${i + 1}`,
    firstName: `Name${i + 1}`,
    fullName: `Name${i + 1} Last`,
    initials: `N${i + 1}`,
  },
  when: Some({ text: "Thu", tone: "muted", past: false }),
  inactive: false,
}));

function renderCarousel(page: number, selectedId = "u2", list = people, hiddenInactive = 0) {
  const onPageChange = vi.fn();
  const onSelect = vi.fn();
  const onShowInactive = vi.fn();
  render(
    <PersonCarousel
      people={list}
      hiddenInactive={hiddenInactive}
      onShowInactive={onShowInactive}
      selectedId={selectedId}
      page={page}
      onPageChange={onPageChange}
      onSelect={onSelect}
    />
  );
  return { onPageChange, onSelect, onShowInactive };
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

describe("PersonCarousel when lines and inactive people", () => {
  const five = people.slice(0, 5);

  it("shows each person's when line in its tone", () => {
    const list: CarouselPerson[] = [
      { ...people[0], when: Some({ text: "2:30pm", tone: "accent", past: false }) },
      { ...people[1], when: Some({ text: "Jun 16", tone: "faint", past: true }), inactive: true },
      { ...people[2], when: None },
    ];
    renderCarousel(0, "u1", list);
    expect(screen.getByText("2:30pm")).toHaveClass("text-brand", "tabular-nums", "truncate");
    const past = screen.getByText("Jun 16");
    expect(past).toHaveClass("text-faint");
    expect(past).toHaveTextContent("Last Jun 16");
    expect(past.querySelector(".sr-only")).toHaveTextContent("Last");
    expect(card("Name2")).toHaveClass("opacity-55");
    expect(card("Name1")).not.toHaveClass("opacity-55");
  });

  it("puts the inactive card after the people and shows them on click", () => {
    const { onShowInactive } = renderCarousel(0, "u1", five.slice(0, 4), 3);
    const inactive = screen.getByRole("button", { name: "Show 3 inactive" });
    expect(inactive).toHaveTextContent("+3InactiveShow");
    fireEvent.click(inactive);
    expect(onShowInactive).toHaveBeenCalled();
  });

  it("counts the inactive card as a card when paging", () => {
    renderCarousel(0, "u1", five, 2);
    expect(screen.getByRole("button", { name: "Next people" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show 2 inactive" })).toHaveAttribute("inert");
  });

  it("renders no inactive card when none are hidden", () => {
    renderCarousel(0, "u1", five, 0);
    expect(screen.queryByRole("button", { name: /inactive/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next people" })).toBeDisabled();
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

  it("counts the trailing inactive card", () => {
    expect(cardCount(5, 0)).toBe(5);
    expect(cardCount(5, 3)).toBe(6);
  });

  it("finds a person's page", () => {
    expect(pageOf("u6", people)).toBe(1);
    expect(pageOf("missing", people)).toBe(0);
  });
});
