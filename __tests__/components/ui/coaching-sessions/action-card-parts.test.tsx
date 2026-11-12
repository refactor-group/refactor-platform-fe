import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoalPickerPopover } from "@/components/ui/goal-picker-popover";
import { AssigneePickerPopover, DueDatePicker } from "@/components/ui/coaching-sessions/action-card-parts";
import { DateTime } from "ts-luxon";
import { GoalPill } from "@/components/ui/goal-pill";
import { createMockGoal } from "../../../test-utils";
import { NonMemberIdsProvider } from "@/components/ui/coaching-sessions/non-member-ids-context";

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const GOALS = [
  createMockGoal({ id: "goal-1", title: "Improve communication" }),
  createMockGoal({ id: "goal-2", title: "Build leadership skills" }),
];

describe("GoalPill", () => {
  it("renders the goal title", () => {
    render(
      <Wrapper>
        <GoalPill title="Improve communication" />
      </Wrapper>
    );

    expect(screen.getByTestId("goal-pill")).toHaveTextContent("Improve communication");
  });

  it("does not render unlink button when onUnlink is not provided", () => {
    render(
      <Wrapper>
        <GoalPill title="Improve communication" />
      </Wrapper>
    );

    expect(screen.queryByRole("button", { name: /unlink goal/i })).not.toBeInTheDocument();
  });

  it("renders unlink button and calls onUnlink when clicked", async () => {
    const user = userEvent.setup();
    const onUnlink = vi.fn();

    render(
      <Wrapper>
        <GoalPill title="Improve communication" onUnlink={onUnlink} />
      </Wrapper>
    );

    await user.click(screen.getByRole("button", { name: /unlink goal/i }));
    expect(onUnlink).toHaveBeenCalledOnce();
  });
});

describe("GoalPickerPopover", () => {
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
  });

  it("renders 'None' placeholder when no goal is selected", () => {
    render(
      <Wrapper>
        <GoalPickerPopover goals={GOALS} onChange={onChange} />
      </Wrapper>
    );

    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("renders the selected goal title when a goal is linked", () => {
    render(
      <Wrapper>
        <GoalPickerPopover
          goals={GOALS}
          selectedGoalId="goal-1"
          onChange={onChange}
        />
      </Wrapper>
    );

    expect(screen.getByText("Improve communication")).toBeInTheDocument();
  });

  it("calls onChange with goal ID when a goal is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <GoalPickerPopover goals={GOALS} onChange={onChange} />
      </Wrapper>
    );

    await user.click(screen.getByText("None"));

    const popover = await screen.findByRole("dialog");
    await user.click(within(popover).getByText("Improve communication"));

    expect(onChange).toHaveBeenCalledWith("goal-1");
  });

  it("shows unlink option when a goal is selected and calls onChange with undefined", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <GoalPickerPopover
          goals={GOALS}
          selectedGoalId="goal-1"
          onChange={onChange}
        />
      </Wrapper>
    );

    await user.click(screen.getByText("Improve communication"));

    const popover = await screen.findByRole("dialog");
    await user.click(within(popover).getByText("Unlink"));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("does not open popover when disabled", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <GoalPickerPopover goals={GOALS} onChange={onChange} disabled />
      </Wrapper>
    );

    await user.click(screen.getByText("None"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AssigneePickerPopover", () => {
  const PEOPLE = [
    { id: "coach-1", name: "Jim Hodapp", initials: "JH" },
    { id: "coachee-1", name: "Caleb Bourg", initials: "CB" },
  ];

  function renderPicker(assigneeIds: string[], onToggle = vi.fn(), disabledReasons = {}) {
    render(
      <Wrapper>
        <AssigneePickerPopover
          allAssignees={PEOPLE}
          resolvedAssignees={PEOPLE.filter((p) => assigneeIds.includes(p.id))}
          assigneeIds={assigneeIds}
          onToggle={onToggle}
          disabledReasons={disabledReasons}
        />
      </Wrapper>
    );
    return onToggle;
  }

  it("shows the assignees' avatars in a borderless field pill", () => {
    renderPicker(["coach-1"]);
    const trigger = screen.getByRole("button", { name: "Assignees" });
    expect(trigger).toHaveClass("rounded-full", "hover:bg-fill");
    expect(trigger).not.toHaveClass("border");
    expect(within(trigger).getByText("JH")).toBeInTheDocument();
  });

  it("says Unassigned when nobody is assigned", () => {
    renderPicker([]);
    expect(within(screen.getByRole("button", { name: "Assignees" })).getByText("Unassigned")).toBeInTheDocument();
  });

  it("lists people with avatars and a check on the assigned ones, and toggles on click", async () => {
    const onToggle = renderPicker(["coach-1"]);
    await userEvent.click(screen.getByRole("button", { name: "Assignees" }));

    const list = screen.getByRole("listbox", { name: "Assignees" });
    const jim = within(list).getByRole("option", { name: /Jim Hodapp/ });
    const caleb = within(list).getByRole("option", { name: /Caleb Bourg/ });
    expect(jim).toHaveAttribute("aria-selected", "true");
    expect(jim.querySelector("svg.text-brand")).not.toBeNull();
    expect(caleb).toHaveAttribute("aria-selected", "false");
    expect(caleb.querySelector("svg.text-brand")).toBeNull();
    expect(list.querySelector('[role="checkbox"]')).toBeNull();

    await userEvent.click(caleb);
    expect(onToggle).toHaveBeenCalledWith("coachee-1");
  });

  it("explains and blocks a person who can't be picked", async () => {
    const onToggle = renderPicker([], vi.fn(), {
      "coach-1": "Only your coach can assign an action to themselves.",
    });
    await userEvent.click(screen.getByRole("button", { name: "Assignees" }));

    const jim = screen.getByRole("option", { name: /Jim Hodapp/ });
    expect(jim).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Only your coach can assign an action to themselves.")).toBeInTheDocument();
    await userEvent.click(jim);
    expect(onToggle).not.toHaveBeenCalled();
  });

  describe("with a participant who is no longer a member", () => {
    function renderLeft(assigneeIds: string[]) {
      const onToggle = vi.fn();
      render(
        <Wrapper>
          <NonMemberIdsProvider ids={["coachee-1"]}>
            <AssigneePickerPopover
              allAssignees={PEOPLE}
              resolvedAssignees={PEOPLE.filter((p) => assigneeIds.includes(p.id))}
              assigneeIds={assigneeIds}
              onToggle={onToggle}
            />
          </NonMemberIdsProvider>
        </Wrapper>
      );
      return onToggle;
    }

    it("can't newly assign them, and says why", async () => {
      const onToggle = renderLeft(["coach-1"]);
      await userEvent.click(screen.getByRole("button", { name: "Assignees" }));

      const caleb = screen.getByRole("option", { name: /Caleb Bourg/ });
      expect(caleb).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("Caleb Bourg is no longer in this organization")).toBeInTheDocument();
      await userEvent.click(caleb);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it("can still unassign them", async () => {
      const onToggle = renderLeft(["coachee-1"]);
      await userEvent.click(screen.getByRole("button", { name: "Assignees" }));

      await userEvent.click(screen.getByRole("option", { name: /Caleb Bourg/ }));
      expect(onToggle).toHaveBeenCalledWith("coachee-1");
    });
  });
});

describe("DueDatePicker", () => {
  it("opens the calendar on the due date's month, not today's", async () => {
    render(
      <Wrapper>
        <DueDatePicker
          value={DateTime.fromISO("2025-02-14")}
          onChange={vi.fn()}
          locale="en-US"
          variant="button"
        />
      </Wrapper>
    );

    await userEvent.click(screen.getByRole("button", { name: /Feb 14, 2025/ }));
    expect(screen.getByText("February 2025")).toBeInTheDocument();
  });
});
