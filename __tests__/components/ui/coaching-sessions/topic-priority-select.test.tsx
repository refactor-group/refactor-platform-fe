import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TopicPrioritySelect } from "@/components/ui/coaching-sessions/topic-priority-select";
import { TopicPriority } from "@/types/coaching-session-topic";
import { Some, None } from "@/types/option";

describe("TopicPrioritySelect — display + gating", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the placeholder when priority is unset", () => {
    render(
      <TopicPrioritySelect priority={None} editable onChange={vi.fn()} />
    );
    expect(screen.getByText("Priority")).toBeInTheDocument();
  });

  it("shows the level label when priority is set", () => {
    render(
      <TopicPrioritySelect
        priority={Some(TopicPriority.High)}
        editable
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("combobox", { name: /priority/i })
    ).toHaveTextContent("High");
  });

  it("renders a static read-only chip (no dropdown) for a coach when set", () => {
    render(
      <TopicPrioritySelect
        priority={Some(TopicPriority.Medium)}
        editable={false}
        onChange={vi.fn()}
      />
    );
    // No dropdown affordance at all — it must not imply the coach can set it.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("shows an explicit 'Priority Not Set' label (no dropdown) for a coach when unset", () => {
    render(
      <TopicPrioritySelect priority={None} editable={false} onChange={vi.fn()} />
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Priority Not Set")).toBeInTheDocument();
  });
});

describe("TopicPrioritySelect — coachee picks a level", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emits Some(level) when a level is chosen", () => {
    const onChange = vi.fn();
    render(
      <TopicPrioritySelect priority={None} editable onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("combobox", { name: /priority/i }));
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByText("Medium"));
    expect(onChange).toHaveBeenCalledWith(Some(TopicPriority.Medium));
  });

  it("offers a Clear row that emits None when a priority is set", () => {
    const onChange = vi.fn();
    render(
      <TopicPrioritySelect
        priority={Some(TopicPriority.High)}
        editable
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("combobox", { name: /priority/i }));
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByText("Clear"));
    expect(onChange).toHaveBeenCalledWith(None);
  });
});
