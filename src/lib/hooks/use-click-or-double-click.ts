import { useEffect, useMemo, useRef } from "react";

export const DOUBLE_CLICK_WINDOW_MS = 260;

interface ClickHandlers {
  onClick: () => void;
  onDoubleClick: () => void;
}

export function useClickOrDoubleClick(onClick: () => void, onDoubleClick: () => void): ClickHandlers {
  const latest = useRef({ onClick, onDoubleClick });
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    latest.current = { onClick, onDoubleClick };
  }, [onClick, onDoubleClick]);
  useEffect(() => () => clearTimeout(pending.current), []);

  return useMemo(
    () => ({
      onClick: () => {
        clearTimeout(pending.current);
        pending.current = setTimeout(() => latest.current.onClick(), DOUBLE_CLICK_WINDOW_MS);
      },
      onDoubleClick: () => {
        clearTimeout(pending.current);
        latest.current.onDoubleClick();
      },
    }),
    []
  );
}
