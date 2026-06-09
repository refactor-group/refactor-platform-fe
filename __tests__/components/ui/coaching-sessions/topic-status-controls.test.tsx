import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopicStatusControls } from "@/components/ui/coaching-sessions/topic-status-controls";
import { TopicStatus } from "@/types/coaching-session-topic";

describe("TopicStatusControls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reflects the active state via aria-pressed", () => {
    render(
      <TopicStatusControls
        status={TopicStatus.Discussed}
        editable
        onChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /mark as not discussed/i })
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /defer to next session/i })
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("sets Discussed when the Discussed toggle is clicked from Open", () => {
    const onChange = vi.fn();
    render(
      <TopicStatusControls status={TopicStatus.Open} editable onChange={onChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /mark as discussed/i }));
    expect(onChange).toHaveBeenCalledWith(TopicStatus.Discussed);
  });

  it("returns to Open when the active state is clicked again (tri-state toggle)", () => {
    const onChange = vi.fn();
    render(
      <TopicStatusControls
        status={TopicStatus.Deferred}
        editable
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /undo defer/i }));
    expect(onChange).toHaveBeenCalledWith(TopicStatus.Open);
  });

  it("switches directly between states", () => {
    const onChange = vi.fn();
    render(
      <TopicStatusControls
        status={TopicStatus.Discussed}
        editable
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /defer to next session/i }));
    expect(onChange).toHaveBeenCalledWith(TopicStatus.Deferred);
  });

  it("is non-interactive and never calls onChange when not editable", () => {
    const onChange = vi.fn();
    render(
      <TopicStatusControls
        status={TopicStatus.Open}
        editable={false}
        onChange={onChange}
      />
    );
    const discussed = screen.getByRole("button", { name: /mark as discussed/i });
    expect(discussed).toBeDisabled();
    fireEvent.click(discussed);
    expect(onChange).not.toHaveBeenCalled();
  });
});
