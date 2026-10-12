import { describe, it, expect, vi } from "vitest";
import { centerInContainer } from "@/lib/utils/center-in-container";

function box(top: number, scrollHeight: number, clientHeight: number, offsetHeight = 0) {
  const el = document.createElement("div");
  Object.defineProperties(el, {
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: clientHeight },
    offsetHeight: { value: offsetHeight },
  });
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  el.scrollBy = vi.fn();
  el.scrollIntoView = vi.fn();
  return el;
}

describe("centerInContainer", () => {
  it("scrolls only a container that scrolls, centering the element in it", () => {
    const container = box(100, 2000, 400);
    const el = box(900, 20, 20, 20);

    centerInContainer(container, el);

    // 900 - 100 - 400 / 2 + 20 / 2
    expect(container.scrollBy).toHaveBeenCalledWith({ top: 610, behavior: "smooth" });
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it("falls back to scrollIntoView when the container does not scroll on its own", () => {
    const container = box(0, 400, 400);
    const el = box(300, 20, 20, 20);

    centerInContainer(container, el);

    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
    expect(container.scrollBy).not.toHaveBeenCalled();
  });
});
