"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Option, None, Some } from "@/types/option";

export interface HoverIntent<K> {
  active: Option<K>;
  enter: (key: K) => void;
  leave: () => void;
}

/** Activates a hovered key once the pointer has rested on it for `delayMs`. */
export function useHoverIntent<K>(delayMs: number): HoverIntent<K> {
  const [active, setActive] = useState<Option<K>>(None);
  const timer = useRef<Option<ReturnType<typeof setTimeout>>>(None);

  const clearTimer = useCallback(() => {
    if (timer.current.some) clearTimeout(timer.current.val);
    timer.current = None;
  }, []);

  const enter = useCallback(
    (key: K) => {
      clearTimer();
      timer.current = Some(
        setTimeout(() => {
          timer.current = None;
          setActive(Some(key));
        }, delayMs)
      );
    },
    [clearTimer, delayMs]
  );

  const leave = useCallback(() => {
    clearTimer();
    setActive(None);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { active, enter, leave };
}
