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

function renderFilter(selected: Option<FilterPerson> = None) {
  const onSelect = vi.fn();
  const onClear = vi.fn();
  render(<WeekFilter people={people} selected={selected} onSelect={onSelect} onClear={onClear} />);
  return { onSelect, onClear };
}

const open = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const popover = () => screen.getByRole("dialog");

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
    expect(within(panel).getByRole("option", { name: "All sessions" })).toHaveAttribute("aria-selected", "true");
  });

  it("narrows by search and says when no one matches", () => {
    renderFilter();
    open("All sessions");
    const search = within(popover()).getByRole("searchbox", { name: "Find a person" });
    fireEvent.change(search, { target: { value: "sam" } });
    expect(within(popover()).getAllByRole("option").map((o) => o.textContent)).toEqual(["All sessions", "Sam Ruiz"]);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(within(popover()).getByText("No one matches.")).toBeInTheDocument();
  });

  it("selects a person and closes", () => {
    const { onSelect } = renderFilter();
    open("All sessions");
    fireEvent.click(within(popover()).getByRole("option", { name: "Erin Park" }));
    expect(onSelect).toHaveBeenCalledWith("u-erin");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("marks the selected person and clears from All sessions", () => {
    const { onClear } = renderFilter(Some(people[1]));
    open("Sam Ruiz");
    expect(within(popover()).getByRole("option", { name: "Sam Ruiz" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(popover()).getByRole("option", { name: "All sessions" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
