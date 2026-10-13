"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";

/**
 * A controlled Radix tooltip that also opens on a tap or click and closes on a
 * second one, Escape, or a press anywhere else. Spread `root` on `Tooltip` and
 * `trigger` on the trigger element.
 */
export function useTapTooltip() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openAtPress = useRef(false);
  const toggledByTouch = useRef(false);
  const lastPointer = useRef("mouse");

  // A tapped tooltip stays open until Escape or a press anywhere else, including another trigger.
  useEffect(() => {
    if (!open) return;
    const closeOutside = (e: globalThis.PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const closeOnEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  // Radix closes on pointerdown before the click lands, so toggle from the state at press time.
  // Safari sends no click after a prevented touch press, so touch toggles on pointerup instead.
  const keepOpen = (e: PointerEvent) => {
    lastPointer.current = e.pointerType;
    openAtPress.current = open;
    e.preventDefault();
  };
  const toggleOnTouch = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    toggledByTouch.current = true;
    setOpen(!openAtPress.current);
  };
  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    if (toggledByTouch.current) {
      toggledByTouch.current = false;
      return;
    }
    // A keyboard click (detail 0) has no press, so it toggles from the current state.
    setOpen(e.detail === 0 ? !open : !openAtPress.current);
  };

  return {
    open,
    setOpen,
    root: {
      open,
      // After a touch, Radix's hover and dismiss logic would undo the tap, so only a mouse drives it.
      onOpenChange: (next: boolean) => {
        if (lastPointer.current === "mouse") setOpen(next);
      },
    },
    trigger: {
      ref: triggerRef,
      onPointerEnter: (e: PointerEvent) => {
        if (e.pointerType === "mouse") lastPointer.current = "mouse";
      },
      onPointerDown: keepOpen,
      onPointerUp: toggleOnTouch,
      onClick: toggle,
    },
  };
}
