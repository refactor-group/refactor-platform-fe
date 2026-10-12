// Centering an element without scrollIntoView, which also scrolls clipped
// (overflow: hidden) layout boxes and so shifts the whole page.

/** The vertical offset that puts `el` in the middle of a box at `top` with `height`. */
function offsetToCenter(el: HTMLElement, top: number, height: number): number {
  return el.getBoundingClientRect().top - top - height / 2 + el.offsetHeight / 2;
}

/**
 * Smoothly centers `el` in `container`, leaving every other box where it is.
 * When `container` does not scroll on its own, centers it in the nearest box
 * that does instead.
 */
export function centerInContainer(container: HTMLElement, el: HTMLElement): void {
  if (container.scrollHeight <= container.clientHeight) {
    centerInScrollParent(el);
    return;
  }
  const top = offsetToCenter(el, container.getBoundingClientRect().top, container.clientHeight);
  container.scrollBy({ top, behavior: "smooth" });
}

/**
 * Centers `el` in the nearest ancestor that scrolls on its own, or else in the
 * window (a phone, where the page scrolls). Clipped layout boxes never move.
 */
export function centerInScrollParent(el: HTMLElement): void {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const scrolls = /auto|scroll/.test(getComputedStyle(node).overflowY);
    if (scrolls && node.scrollHeight > node.clientHeight) {
      centerInContainer(node, el);
      return;
    }
  }
  window.scrollBy({ top: offsetToCenter(el, 0, window.innerHeight), behavior: "smooth" });
}
