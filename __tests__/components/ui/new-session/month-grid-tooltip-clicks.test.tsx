import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import * as Dialog from "@radix-ui/react-dialog";
import { MonthGrid } from "@/components/ui/new-session/month-grid";
import { None } from "@/types/option";
import { EHAB, PRIYA, TODAY } from "./fixtures";

afterEach(() => vi.useRealTimers());

describe("MonthGrid day tooltip in a modal dialog", () => {
  it("lets clicks through to the days it covers", () => {
    vi.useFakeTimers();
    render(
      <Dialog.Root open>
        <Dialog.Content aria-describedby={undefined}>
          <Dialog.Title>New session</Dialog.Title>
          <MonthGrid
            month={TODAY}
            today={TODAY}
            selected={None}
            busy={[EHAB, PRIYA]}
            tooltips
            onSelect={vi.fn()}
            onMonthChange={vi.fn()}
          />
        </Dialog.Content>
      </Dialog.Root>
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: /^Tuesday, August 18,/ }));
    act(() => vi.advanceTimersByTime(350));
    // The modal turns pointer events off on the body, and Radix turns them back on for the tooltip.
    expect(document.body.style.pointerEvents).toBe("none");
    const content = document.querySelector("[data-radix-popper-content-wrapper] > div") as HTMLElement;
    expect(content.style.pointerEvents).toBe("none");
  });
});
