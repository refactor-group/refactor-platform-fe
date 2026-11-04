import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { type PickerPerson, PersonPicker } from "@/components/ui/new-session/person-picker";
import { None, Some } from "@/types/option";

const person = (userId: string, fullName: string, inactive = false): PickerPerson => ({
  userId,
  fullName,
  initials: fullName.split(" ").map((p) => p[0]).join(""),
  subline: inactive ? "Last session Jun 12" : "Usually Tuesdays, 2:30 PM",
  inactive,
});

const PEOPLE = [
  person("u-ehab", "Ehab Badawi"),
  person("u-priya", "Priya Raman"),
  person("u-dana", "Dana Ortiz", true),
  person("u-omar", "Omar Haddad", true),
];

const card = (name: string) => screen.queryByRole("button", { name: new RegExp(name) });
const search = () => screen.getByRole("searchbox", { name: "Find a person" });

describe("PersonPicker", () => {
  it("shows active people with their sub-lines", () => {
    render(<PersonPicker people={PEOPLE} selectedId={None} onSelect={vi.fn()} />);
    expect(card("Ehab Badawi")).toBeInTheDocument();
    expect(card("Priya Raman")).toHaveTextContent("Usually Tuesdays, 2:30 PM");
    expect(card("Dana Ortiz")).not.toBeInTheDocument();
    expect(card("Omar Haddad")).not.toBeInTheDocument();
  });

  it("shows and hides inactive people", () => {
    render(<PersonPicker people={PEOPLE} selectedId={None} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Show everyone (+2 inactive)" }));
    expect(card("Dana Ortiz")).toHaveTextContent("Last session Jun 12");
    expect(card("Omar Haddad")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hide inactive" }));
    expect(card("Dana Ortiz")).not.toBeInTheDocument();
  });

  it("searches everyone and hides the link while searching", () => {
    render(<PersonPicker people={PEOPLE} selectedId={None} onSelect={vi.fn()} />);
    fireEvent.change(search(), { target: { value: "dana" } });
    expect(card("Dana Ortiz")).toBeInTheDocument();
    expect(card("Ehab Badawi")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show everyone/ })).not.toBeInTheDocument();
    fireEvent.change(search(), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Show everyone (+2 inactive)" })).toBeInTheDocument();
  });

  it("says when no one matches", () => {
    render(<PersonPicker people={PEOPLE} selectedId={None} onSelect={vi.fn()} />);
    fireEvent.change(search(), { target: { value: "zzz" } });
    expect(screen.getByText("No matches")).toBeInTheDocument();
  });

  it("picks a person and marks the pick", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PersonPicker people={PEOPLE} selectedId={None} onSelect={onSelect} />);
    fireEvent.click(card("Priya Raman")!);
    expect(onSelect).toHaveBeenCalledWith("u-priya");
    rerender(<PersonPicker people={PEOPLE} selectedId={Some("u-priya")} onSelect={onSelect} />);
    expect(card("Priya Raman")).toHaveAttribute("aria-pressed", "true");
    expect(card("Ehab Badawi")).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps a picked inactive person visible", () => {
    render(<PersonPicker people={PEOPLE} selectedId={Some("u-dana")} onSelect={vi.fn()} />);
    expect(card("Dana Ortiz")).toBeInTheDocument();
    expect(card("Omar Haddad")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show everyone (+2 inactive)" })).toBeInTheDocument();
  });

  it("has no link when everyone is active", () => {
    render(<PersonPicker people={PEOPLE.slice(0, 2)} selectedId={None} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Show everyone/ })).not.toBeInTheDocument();
  });
});
