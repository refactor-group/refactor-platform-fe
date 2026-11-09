import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { StepDialog, StepDialogHeight, StepDialogVariant } from "@/components/ui/step-dialog";
import { Some } from "@/types/option";

/** A matchMedia whose answer the test can flip, notifying the hook like a real resize. */
function resizableViewport(initiallyDesktop: boolean) {
  let desktop = initiallyDesktop;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return desktop;
      },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    }))
  );
  return (next: boolean) =>
    act(() => {
      desktop = next;
      listeners.forEach((listener) => listener());
    });
}

afterEach(() => vi.unstubAllGlobals());

function renderDialog() {
  render(
    <StepDialog
      open
      onClose={vi.fn()}
      title="New session"
      steps={[{ id: "who", label: "Who", value: "Choose a person", done: false, current: true }]}
      stepTitle="Who this session is with"
      position={{ index: 1, total: 3 }}
      lead={{ kind: "none" }}
      onPrev={Some(vi.fn())}
      onNext={Some(vi.fn())}
      height={StepDialogHeight.Tall}
      variant={StepDialogVariant.Steps}
    >
      <input aria-label="Find a person" />
    </StepDialog>
  );
}

const search = () => screen.getByRole("textbox", { name: "Find a person" }) as HTMLInputElement;

describe("StepDialog across the 900px breakpoint", () => {
  it("keeps what's typed in the step body when the window narrows", () => {
    const resize = resizableViewport(true);
    renderDialog();
    fireEvent.change(search(), { target: { value: "Ehab" } });
    const field = search();
    resize(false);
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(search()).toBe(field);
    expect(search().value).toBe("Ehab");
  });

  it("keeps it when the window widens again", () => {
    const resize = resizableViewport(false);
    renderDialog();
    fireEvent.change(search(), { target: { value: "Priya" } });
    resize(true);
    expect(screen.getByRole("list", { name: "Steps" })).toBeInTheDocument();
    expect(search().value).toBe("Priya");
  });
});
