import { useCallback, useLayoutEffect, type RefObject } from "react";

/**
 * Grows a textarea with its content up to `maxRows`, then scrolls. Sizes before
 * paint (no 1-frame flash on mount/enter) and re-measures whenever `value`
 * changes. Pass `enabled: false` while the textarea is unmounted (e.g. a
 * display/edit toggle) so the effect no-ops until it is on screen.
 */
export function useAutosizeTextarea(
  ref: RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxRows: number,
  enabled = true
): void {
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const cs = window.getComputedStyle(el);
    const lineHeight = parseFloat(cs.lineHeight) || 18;
    const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const borderY =
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    const maxHeight = lineHeight * maxRows + paddingY + borderY;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, maxRows]);

  useLayoutEffect(() => {
    if (enabled) resize();
  }, [enabled, value, resize]);
}
