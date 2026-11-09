import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { None, Some, type Option } from "@/types/option";
import { PersonGroup, type FilterPerson } from "@/lib/week-grid/filter";
import { WeekFilter } from "@/components/ui/dashboard/week-grid/week-filter";

const people: FilterPerson[] = [
  { userId: "u-alex", fullName: "Alex Chen", relationshipIds: ["rel-alex"], group: PersonGroup.Coachees },
  { userId: "u-sam", fullName: "Sam Ruiz", relationshipIds: ["rel-sam"], group: PersonGroup.Coachees },
  { userId: "u-erin", fullName: "Erin Park", relationshipIds: ["rel-erin"], group: PersonGroup.Inactive },
];

function renderFilter(selected: Option<FilterPerson> = None, grouped = true) {
  const onSelect = vi.fn();
  const onClear = vi.fn();
  const onOpen = vi.fn();
  render(
    <WeekFilter
      people={people}
      grouped={grouped}
      selected={selected}
      onSelect={onSelect}
      onClear={onClear}
      onOpen={onOpen}
    />
  );
  return { onSelect, onClear, onOpen };
}

const open = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const popover = () => screen.getByRole("dialog");
const list = () => within(popover()).getByRole("group", { name: "Filter by person" });
const choice = (name: string) => within(list()).getByRole("button", { name });

describe("WeekFilter", () => {
  it("labels the pill All sessions, or the selected name", () => {
    renderFilter();
    expect(screen.getByRole("button", { name: "All sessions" })).toBeInTheDocument();
  });

  it("labels the pill with the selected person", () => {
    renderFilter(Some(people[0]));
    expect(screen.getByRole("button", { name: "Alex Chen" })).toBeInTheDocument();
  });

  it("opens to a search, All sessions, and the Coachees and Inactive groups", () => {
    renderFilter();
    open("All sessions");
    const panel = popover();
    expect(within(panel).getByRole("searchbox", { name: "Find a person" })).toBeInTheDocument();
    expect(within(panel).getByRole("group", { name: "Coachees" })).toHaveTextContent("Alex Chen");
    expect(within(panel).getByRole("group", { name: "Coachees" })).toHaveTextContent("Sam Ruiz");
    expect(within(panel).getByRole("group", { name: "Inactive" })).toHaveTextContent("Erin Park");
    expect(choice("All sessions")).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).queryByRole("listbox")).not.toBeInTheDocument();
    expect(within(panel).queryByRole("option")).not.toBeInTheDocument();
  });

  it("asks for activity when it opens", () => {
    const { onOpen } = renderFilter();
    expect(onOpen).not.toHaveBeenCalled();
    open("All sessions");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("holds the people back until they're grouped, so the list never shifts", () => {
    renderFilter(None, false);
    open("All sessions");
    expect(choice("All sessions")).toBeInTheDocument();
    expect(within(popover()).getByRole("status", { name: "Loading people" })).toBeInTheDocument();
    expect(within(popover()).queryByText("Alex Chen")).not.toBeInTheDocument();
    expect(within(popover()).queryByRole("group", { name: "Coachees" })).not.toBeInTheDocument();
  });

  it("narrows by search and says when no one matches", () => {
    renderFilter();
    open("All sessions");
    const search = within(popover()).getByRole("searchbox", { name: "Find a person" });
    fireEvent.change(search, { target: { value: "sam" } });
    expect(within(list()).getAllByRole("button").map((o) => o.textContent)).toEqual(["All sessions", "Sam Ruiz"]);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(within(popover()).getByText("No one matches.")).toBeInTheDocument();
  });

  it("selects a person and closes", () => {
    const { onSelect } = renderFilter();
    open("All sessions");
    fireEvent.click(choice("Erin Park"));
    expect(onSelect).toHaveBeenCalledWith("u-erin");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks the selected person and clears from All sessions", () => {
    const { onClear } = renderFilter(Some(people[1]));
    open("Sam Ruiz");
    expect(choice("Sam Ruiz")).toHaveAttribute("aria-pressed", "true");
    expect(choice("All sessions")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(choice("All sessions"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
