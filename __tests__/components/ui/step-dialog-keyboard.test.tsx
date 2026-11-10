import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { StepDialog, StepDialogHeight, StepDialogVariant, type StepDialogLead } from "@/components/ui/step-dialog";
import { None } from "@/types/option";

// iOS keeps the layout viewport when its keyboard opens and shrinks only the visual viewport.
class FakeVisualViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
  show(height: number, offsetTop = 0) {
    this.height = height;
    this.offsetTop = offsetTop;
    act(() => {
      this.dispatchEvent(new Event("resize"));
    });
  }
}

let visual: FakeVisualViewport;

function viewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

beforeEach(() => {
  visual = new FakeVisualViewport();
  vi.stubGlobal("visualViewport", visual);
  vi.stubGlobal("innerHeight", 844);
});

afterEach(() => vi.unstubAllGlobals());

function renderDialog() {
  render(
    <StepDialog
      open
      onClose={vi.fn()}
      title="New session"
      steps={[]}
      stepTitle="Repeat"
      position={{ index: 3, total: 3 }}
      lead={{ kind: "none" } as StepDialogLead}
      onPrev={None}
      onNext={None}
      height={StepDialogHeight.Tall}
      variant={StepDialogVariant.Steps}
    >
      <input aria-label="Number of sessions" />
    </StepDialog>
  );
  return screen.getByRole("dialog");
}

describe("StepDialog on a phone with the keyboard open", () => {
  it("fits the part of the screen the keyboard leaves, so its body can scroll", () => {
    viewport(false);
    const dialog = renderDialog();
    expect(dialog.style.height).toBe("");
    visual.show(420, 120);
    expect(dialog.style.height).toBe("420px");
    expect(dialog.style.top).toBe("120px");
    visual.show(844);
    expect(dialog.style.height).toBe("");
  });

  it("scrolls the focused field into view once the keyboard is up", () => {
    viewport(false);
    renderDialog();
    const field = screen.getByLabelText("Number of sessions");
    const scrollIntoView = vi.fn();
    field.scrollIntoView = scrollIntoView;
    act(() => field.focus());
    visual.show(420);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("leaves the desktop dialog alone", () => {
    viewport(true);
    const dialog = renderDialog();
    visual.show(420);
    expect(dialog.style.height).toBe("");
  });
});
