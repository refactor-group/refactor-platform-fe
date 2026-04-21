import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Detects whether a text element is clipped (e.g. by line-clamp) and
 * provides expand/collapse toggle state.
 *
 * Used by both CompactGoalCard (title) and CompactAgreementCard (body)
 * to allow clicking clipped text to reveal the full content.
 */
export function useTextClamp(text: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isClipped, setIsClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;

    const check = () => setIsClipped(el.scrollHeight > el.clientHeight);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  return { ref, expanded, isClipped, toggle };
}
