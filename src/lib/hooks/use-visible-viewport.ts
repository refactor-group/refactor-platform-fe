"use client";

import { useEffect, useState } from "react";
import { type Option, None, Some } from "@/types/option";

export interface VisibleViewport {
  top: number;
  height: number;
}

/**
 * The part of the screen an on-screen keyboard leaves visible; None while nothing covers it.
 * iOS keeps the layout viewport when its keyboard opens, so full-screen fixed views need this to stay scrollable.
 */
export function useVisibleViewport(enabled: boolean): Option<VisibleViewport> {
  const [visible, setVisible] = useState<Option<VisibleViewport>>(None);

  useEffect(() => {
    const visual = window.visualViewport;
    if (!enabled || !visual) return;
    const update = () =>
      setVisible(
        visual.height < window.innerHeight - 1 ? Some({ top: visual.offsetTop, height: visual.height }) : None
      );
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
      setVisible(None);
    };
  }, [enabled]);

  return visible;
}
