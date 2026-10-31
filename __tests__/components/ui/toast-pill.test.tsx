import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastPill, type ToastKind } from "@/components/ui/toast-pill";
import { type Option, None, Some } from "@/types/option";

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX/clientY.
if (typeof window.PointerEvent === "undefined") {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
}

interface RenderArgs {
  kind?: ToastKind;
  message?: string;
  durationMs?: Option<number>;
  action?: Option<{ label: string; onClick: () => void }>;
  cancel?: Option<{ label: string; onClick: () => void }>;
}

function renderPill(args: RenderArgs = {}) {
  const onDismiss = vi.fn();
  const utils = render(
    <ToastPill
      kind={args.kind ?? "neutral"}
      message={args.message ?? "Saved"}
      durationMs={args.durationMs ?? Some(6000)}
      action={args.action ?? None}
      cancel={args.cancel ?? None}
      onDismiss={onDismiss}
    />
  );
  const pill = utils.container.querySelector<HTMLElement>("[data-kind]")!;
  const ring = utils.container.querySelector<SVGCircleElement>('[data-slot="toast-ring"]');
  return { ...utils, onDismiss, pill, ring };
}

function swipe(pill: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }, holdMs = 0) {
  fireEvent.pointerDown(pill, { clientX: from.x, clientY: from.y, pointerId: 1 });
  fireEvent.pointerMove(pill, { clientX: to.x, clientY: to.y, pointerId: 1 });
  if (holdMs > 0) act(() => vi.advanceTimersByTime(holdMs));
  fireEvent.pointerUp(pill, { clientX: to.x, clientY: to.y, pointerId: 1 });
}

describe("ToastPill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the success check and a status role", () => {
    const { pill } = renderPill({ kind: "success", message: "Saved" });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(pill.querySelector(".text-toast-check")).not.toBeNull();
    expect(pill).toHaveAttribute("role", "status");
  });

  it("uses role=alert for errors and role=status otherwise", () => {
    expect(renderPill({ kind: "error" }).pill).toHaveAttribute("role", "alert");
    for (const kind of ["neutral", "info", "warning", "loading"] as const) {
      expect(renderPill({ kind }).pill).toHaveAttribute("role", "status");
    }
  });

  it("leaves errors assertive and announces others politely", () => {
    const error = renderPill({ kind: "error" }).pill;
    expect(error).toHaveAttribute("role", "alert");
    expect(error).not.toHaveAttribute("aria-live");
    const success = renderPill({ kind: "success" }).pill;
    expect(success).toHaveAttribute("role", "status");
    expect(success).toHaveAttribute("aria-live", "polite");
  });

  it("dismisses once when the pill is clicked", () => {
    const { pill, onDismiss } = renderPill();
    fireEvent.click(pill);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("runs the action then dismisses exactly once", () => {
    const onClick = vi.fn();
    const { onDismiss } = renderPill({ action: Some({ label: "Undo", onClick }) });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("runs only the cancel handler when cancel is clicked", () => {
    const actionClick = vi.fn();
    const cancelClick = vi.fn();
    const { onDismiss } = renderPill({
      action: Some({ label: "Show", onClick: actionClick }),
      cancel: Some({ label: "Undo", onClick: cancelClick }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(cancelClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(actionClick).not.toHaveBeenCalled();
  });

  it("dismisses when the countdown ring finishes", () => {
    const { ring, onDismiss } = renderPill();
    fireEvent.animationEnd(ring!);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders no ring without a duration", () => {
    expect(renderPill({ durationMs: None }).ring).toBeNull();
  });

  it("pauses on hover and focus within", () => {
    const { pill } = renderPill({ action: Some({ label: "Undo", onClick: vi.fn() }) });
    expect(pill).toHaveAttribute("data-paused", "false");
    fireEvent.mouseEnter(pill);
    expect(pill).toHaveAttribute("data-paused", "true");
    fireEvent.mouseLeave(pill);
    expect(pill).toHaveAttribute("data-paused", "false");
    act(() => screen.getByRole("button", { name: "Undo" }).focus());
    expect(pill).toHaveAttribute("data-paused", "true");
  });

  it("dismisses on a horizontal swipe past the threshold", () => {
    const { pill, onDismiss } = renderPill();
    swipe(pill, { x: 100, y: 100 }, { x: 200, y: 100 });
    act(() => vi.advanceTimersByTime(250));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("springs back on a short, slow swipe", () => {
    const { pill, onDismiss } = renderPill();
    swipe(pill, { x: 100, y: 100 }, { x: 150, y: 100 }, 1000);
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(pill).toHaveAttribute("data-swiping", "false");
  });

  it("never starts a swipe on vertical movement", () => {
    const { pill, onDismiss } = renderPill();
    fireEvent.pointerDown(pill, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pill, { clientX: 105, clientY: 200, pointerId: 1 });
    expect(pill).toHaveAttribute("data-swiping", "false");
    fireEvent.pointerUp(pill, { clientX: 105, clientY: 200, pointerId: 1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("never starts a swipe when vertical movement outweighs horizontal", () => {
    const { pill, onDismiss } = renderPill();
    fireEvent.pointerDown(pill, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pill, { clientX: 120, clientY: 200, pointerId: 1 });
    expect(pill).toHaveAttribute("data-swiping", "false");
    fireEvent.pointerUp(pill, { clientX: 120, clientY: 200, pointerId: 1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not dismiss when a vertical drag ends in a click on the pill", () => {
    const { pill, onDismiss } = renderPill();
    fireEvent.pointerDown(pill, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(pill, { clientX: 102, clientY: 4, pointerId: 1 });
    fireEvent.pointerUp(pill, { clientX: 102, clientY: 4, pointerId: 1 });
    fireEvent.click(pill);
    act(() => vi.advanceTimersByTime(1000));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("keeps pointerdown from reaching the toast container", () => {
    const containerPointerDown = vi.fn();
    render(
      <div onPointerDown={containerPointerDown}>
        <ToastPill
          kind="neutral"
          message="Saved"
          durationMs={None}
          action={None}
          cancel={None}
          onDismiss={vi.fn()}
        />
      </div>
    );
    fireEvent.pointerDown(screen.getByRole("status"), { clientX: 100, clientY: 100, pointerId: 1 });
    expect(containerPointerDown).not.toHaveBeenCalled();
  });

  it("does not count a completed swipe as a click", () => {
    const { pill, onDismiss } = renderPill();
    swipe(pill, { x: 100, y: 100 }, { x: 200, y: 100 });
    fireEvent.click(pill);
    act(() => vi.advanceTimersByTime(250));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
