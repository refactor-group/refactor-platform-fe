import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepDialog, StepDialogHeight } from "@/components/ui/step-dialog";
import { None } from "@/types/option";

function viewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("StepDialog focus on open", () => {
  it.each([true, false])("focuses the dialog itself, not Close (desktop: %s)", (desktop) => {
    viewport(desktop);
    render(
      <StepDialog
        open
        onClose={vi.fn()}
        title="New session"
        steps={[]}
        stepTitle="Who"
        position={{ index: 1, total: 3 }}
        lead={{ kind: "none" }}
        onPrev={None}
        onNext={None}
        height={StepDialogHeight.Tall}
      >
        <button type="button">First control</button>
      </StepDialog>
    );
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveFocus();
  });
});
