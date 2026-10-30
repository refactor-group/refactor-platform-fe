import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { custom, dismiss } = vi.hoisted(() => {
  let next = 0;
  return {
    custom: vi.fn((_jsx: unknown, data?: { id?: string | number }) => data?.id ?? `generated-${++next}`),
    dismiss: vi.fn(),
  };
});

vi.mock("sonner", () => ({ toast: { custom, dismiss } }));

import { handleToastEscape, toast } from "@/lib/toast";

type Factory = (id: string | number) => ReactElement;

function renderLastToast() {
  const factory = custom.mock.calls.at(-1)![0] as Factory;
  return render(factory("rendered-id")).container;
}

const ringDuration = (container: HTMLElement) =>
  container.querySelector<SVGCircleElement>('[data-slot="toast-ring"]')?.style.animationDuration;

describe("toast", () => {
  beforeEach(() => {
    toast.dismiss();
    custom.mockClear();
    dismiss.mockClear();
  });

  it("renders success through sonner's custom toast with its timer disabled", () => {
    toast.success("Saved");
    expect(custom).toHaveBeenCalledTimes(1);
    expect(custom.mock.calls[0][1]).toEqual({ id: undefined, duration: Infinity });
    const container = renderLastToast();
    expect(container).toHaveTextContent("Saved");
    expect(container.querySelector(".text-toast-check")).not.toBeNull();
  });

  it("passes the id option through", () => {
    toast.error("x", { id: "abc" });
    expect(custom.mock.calls[0][1]).toEqual({ id: "abc", duration: Infinity });
  });

  it("renders no ring for loading or infinite toasts", () => {
    toast.loading("Working");
    expect(ringDuration(renderLastToast())).toBeUndefined();
    toast("x", { duration: Infinity });
    expect(ringDuration(renderLastToast())).toBeUndefined();
  });

  it("runs the ring for 6000ms by default and honours duration", () => {
    toast("x");
    expect(ringDuration(renderLastToast())).toBe("6000ms");
    toast("x", { duration: 15000 });
    expect(ringDuration(renderLastToast())).toBe("15000ms");
  });

  it("passes dismiss through to sonner", () => {
    toast.dismiss("abc");
    expect(dismiss).toHaveBeenCalledWith("abc");
  });

  describe("handleToastEscape", () => {
    it("dismisses the newest toast on Escape", () => {
      toast("first", { id: "one" });
      toast("second", { id: "two" });
      dismiss.mockClear();
      expect(handleToastEscape(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(true);
      expect(dismiss).toHaveBeenCalledTimes(1);
      expect(dismiss).toHaveBeenCalledWith("two");
    });

    it("returns false when no toast is showing", () => {
      expect(handleToastEscape(new KeyboardEvent("keydown", { key: "Escape" }))).toBe(false);
      expect(dismiss).not.toHaveBeenCalled();
    });

    it("leaves the toast when another layer already handled Escape", () => {
      toast("first", { id: "one" });
      dismiss.mockClear();
      const event = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      event.preventDefault();
      expect(handleToastEscape(event)).toBe(false);
      expect(dismiss).not.toHaveBeenCalled();
    });

    it("ignores other keys", () => {
      toast("first", { id: "one" });
      expect(handleToastEscape(new KeyboardEvent("keydown", { key: "Enter" }))).toBe(false);
    });
  });
});
