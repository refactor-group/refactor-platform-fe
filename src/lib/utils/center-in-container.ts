/**
 * Smoothly centers `el` in `container`, leaving the page and every other
 * ancestor where they are. When `container` does not scroll on its own (a
 * phone, where the page scrolls instead), falls back to `scrollIntoView`.
 */
export function centerInContainer(container: HTMLElement, el: HTMLElement): void {
  if (container.scrollHeight <= container.clientHeight) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset =
    elRect.top - containerRect.top - container.clientHeight / 2 + el.offsetHeight / 2;
  container.scrollBy({ top: offset, behavior: "smooth" });
}
