"use client";

import { useCallback, useEffect, useRef } from "react";

import { cn } from "@/components/lib/utils";

interface TranscriptResizeHandleProps {
  /** Current transcript column width in CSS pixels. */
  width: number;
  /** Caller handles clamping via the ui-preferences store. */
  onResize: (nextWidth: number) => void;
  /** Minimum width the handle is allowed to drag to, in CSS pixels. */
  min: number;
  /** Maximum width the handle is allowed to drag to, in CSS pixels. */
  max: number;
}

const KEYBOARD_STEP = 24;

/**
 * Vertical drag handle sitting between the transcript and Notes
 * columns in the 3-column docked layout. Hidden below `lg:` (1024px)
 * where the layout collapses to a sheet.
 *
 * Follows `role="separator"` / `aria-orientation="vertical"` semantics
 * so screen readers announce it correctly. Keyboard: ArrowLeft /
 * ArrowRight nudge by 24px; Home / End jump to the bounds.
 */
export function TranscriptResizeHandle({
  width,
  onResize,
  min,
  max,
}: TranscriptResizeHandleProps) {
  const dragStateRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Primary button only; ignore right-clicks and middle-clicks.
      if (event.button !== 0) return;
      event.preventDefault();
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: width,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [width]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const delta = event.clientX - drag.startX;
      onResize(drag.startWidth + delta);
    },
    [onResize]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragStateRef.current = null;
    },
    []
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onResize(width - KEYBOARD_STEP);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onResize(width + KEYBOARD_STEP);
      } else if (event.key === "Home") {
        event.preventDefault();
        onResize(min);
      } else if (event.key === "End") {
        event.preventDefault();
        onResize(max);
      }
    },
    [width, onResize, min, max]
  );

  // Release any captured pointer on unmount (defensive).
  useEffect(() => {
    return () => {
      dragStateRef.current = null;
    };
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize transcript"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      className={cn(
        "hidden lg:flex items-stretch justify-center cursor-col-resize group",
        // Full-height invisible hit zone with a thin visible bar in the middle
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      )}
    >
      <div
        aria-hidden="true"
        className="w-[2px] h-full bg-border group-hover:bg-foreground/20 transition-colors"
      />
    </div>
  );
}
