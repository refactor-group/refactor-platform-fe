import { describe, it, expect, vi, afterEach } from "vitest";
import { centerInContainer, centerInScrollParent } from "@/lib/utils/center-in-container";

function box(top: number, scrollHeight: number, clientHeight: number, overflowY = "visible") {
  const el = document.createElement("div");
  el.style.overflowY = overflowY;
  Object.defineProperties(el, {
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: clientHeight },
    offsetHeight: { value: 20 },
  });
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  el.scrollBy = vi.fn();
  el.scrollIntoView = vi.fn();
  return el;
}

afterEach(() => vi.restoreAllMocks());

describe("centerInContainer", () => {
  it("scrolls only a container that scrolls, centering the element in it", () => {
    const container = box(100, 2000, 400, "auto");
    const el = box(900, 20, 20);
    container.appendChild(el);

    centerInContainer(container, el);

    // 900 - 100 - 400 / 2 + 20 / 2
    expect(container.scrollBy).toHaveBeenCalledWith({ top: 610, behavior: "smooth" });
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });

  it("uses the nearest box that scrolls when the container does not", () => {
    const outer = box(0, 3000, 600, "auto");
    const container = box(50, 400, 400, "auto");
    const el = box(700, 20, 20);
    outer.appendChild(container);
    container.appendChild(el);

    centerInContainer(container, el);

    expect(container.scrollBy).not.toHaveBeenCalled();
    expect(outer.scrollBy).toHaveBeenCalledWith({ top: 410, behavior: "smooth" });
  });
});

describe("centerInScrollParent", () => {
  it("skips clipped and non-scrolling boxes, falling back to the window", () => {
    const clipped = box(0, 3000, 800, "hidden");
    const el = box(1000, 20, 20);
    clipped.appendChild(el);
    document.body.appendChild(clipped);
    const windowScroll = vi.fn();
    window.scrollBy = windowScroll;
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);

    centerInScrollParent(el);

    expect(clipped.scrollBy).not.toHaveBeenCalled();
    expect(el.scrollIntoView).not.toHaveBeenCalled();
    // 1000 - 0 - 800 / 2 + 20 / 2
    expect(windowScroll).toHaveBeenCalledWith({ top: 610, behavior: "smooth" });
    clipped.remove();
  });
});
