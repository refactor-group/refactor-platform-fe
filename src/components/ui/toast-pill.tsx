"use client";

import { useRef, useState } from "react";
import type {
  CSSProperties,
  FocusEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { type Option, None, Some } from "@/types/option";

export type ToastKind =
  | "neutral"
  | "success"
  | "error"
  | "info"
  | "warning"
  | "loading";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastPillProps {
  kind: ToastKind;
  message: string;
  durationMs: Option<number>;
  action: Option<ToastAction>;
  cancel: Option<ToastAction>;
  onDismiss: () => void;
}

const SWIPE_START_PX = 8;
const SWIPE_DISMISS_PX = 80;
const SWIPE_DISMISS_VELOCITY = 0.3;
const SWIPE_FADE_PX = 120;
const FLING_MS = 200;
const RING_RADIUS = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface SwipeStart {
  x: number;
  y: number;
  time: number;
}

interface SwipeStyle {
  offsetX: number;
  transition: Option<string>;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useSwipeToDismiss(onDismiss: () => void) {
  const start = useRef<Option<SwipeStart>>(None);
  const swipingRef = useRef(false);
  const dragged = useRef(false);
  const [swiping, setSwiping] = useState(false);
  const [style, setStyle] = useState<SwipeStyle>({ offsetX: 0, transition: None });

  const reset = () => {
    start.current = None;
    swipingRef.current = false;
    setSwiping(false);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Keeps Sonner from capturing the pointer, which retargets a drag's click onto the pill.
    event.stopPropagation();
    dragged.current = false;
    start.current = Some({ x: event.clientX, y: event.clientY, time: Date.now() });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current.none) return;
    const dx = event.clientX - start.current.val.x;
    const dy = event.clientY - start.current.val.y;
    if (!swipingRef.current) {
      if (Math.abs(dx) <= SWIPE_START_PX || Math.abs(dx) <= Math.abs(dy)) return;
      swipingRef.current = true;
      setSwiping(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setStyle({ offsetX: dx, transition: None });
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current.none) return;
    const wasSwiping = swipingRef.current;
    const dx = event.clientX - start.current.val.x;
    const dy = event.clientY - start.current.val.y;
    const elapsedMs = Date.now() - start.current.val.time;
    reset();
    dragged.current = wasSwiping || Math.max(Math.abs(dx), Math.abs(dy)) > SWIPE_START_PX;
    if (!wasSwiping) return;
    const reducedMotion = prefersReducedMotion();
    if (Math.abs(dx) > SWIPE_DISMISS_PX || Math.abs(dx) / elapsedMs > SWIPE_DISMISS_VELOCITY) {
      if (reducedMotion) {
        onDismiss();
        return;
      }
      setStyle({
        offsetX: Math.sign(dx) * window.innerWidth,
        transition: Some(`transform ${FLING_MS}ms ease-out`),
      });
      setTimeout(onDismiss, FLING_MS);
      return;
    }
    setStyle({
      offsetX: 0,
      transition: reducedMotion ? None : Some("transform .25s cubic-bezier(.2,.8,.2,1)"),
    });
  };

  // A drag in any direction must not also count as a click.
  const consumeDragClick = () => {
    const wasDrag = dragged.current;
    dragged.current = false;
    return wasDrag;
  };

  const swipeStyle: CSSProperties = {
    transform: `translateX(${style.offsetX}px)`,
    opacity: 1 - Math.min(Math.abs(style.offsetX) / SWIPE_FADE_PX, 1),
    transition: style.transition.some ? style.transition.val : undefined,
  };

  return {
    swiping,
    swipeStyle,
    consumeDragClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset },
  };
}

function LeadingIcon({ kind }: { kind: ToastKind }) {
  switch (kind) {
    case "success":
      return <Check className="h-4 w-4 shrink-0 text-toast-check" aria-hidden />;
    case "error":
      return <CircleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />;
    case "warning":
      return <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden />;
    case "loading":
      return <Spinner className="h-4 w-4 shrink-0" aria-hidden="true" />;
    case "neutral":
    case "info":
      return null;
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled toast kind: ${_exhaustive}`);
    }
  }
}

function ActionButton({
  action,
  onDismiss,
}: {
  action: ToastAction;
  onDismiss: () => void;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    action.onClick();
    onDismiss();
  };
  return (
    <button
      type="button"
      className="shrink-0 font-medium underline underline-offset-2"
      onClick={handleClick}
    >
      {action.label}
    </button>
  );
}

function CountdownRing({
  durationMs,
  paused,
  onElapsed,
}: {
  durationMs: number;
  paused: boolean;
  onElapsed: () => void;
}) {
  return (
    <svg
      viewBox="0 0 18 18"
      className="h-[18px] w-[18px] shrink-0 -rotate-90"
      aria-hidden
    >
      <circle
        r={RING_RADIUS}
        cx={9}
        cy={9}
        fill="none"
        strokeWidth={2}
        className="stroke-inverse-foreground/20"
      />
      <circle
        data-slot="toast-ring"
        r={RING_RADIUS}
        cx={9}
        cy={9}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        className="animate-toast-ring stroke-inverse-foreground"
        style={{
          animationDuration: `${durationMs}ms`,
          animationPlayState: paused ? "paused" : "running",
        }}
        onAnimationEnd={onElapsed}
      />
    </svg>
  );
}

export function ToastPill({
  kind,
  message,
  durationMs,
  action,
  cancel,
  onDismiss,
}: ToastPillProps) {
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const { swiping, swipeStyle, consumeDragClick, handlers } = useSwipeToDismiss(onDismiss);
  const paused = hovered || focusWithin;

  const handleClick = () => {
    if (consumeDragClick()) return;
    onDismiss();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
  };

  const actionButton = (slot: Option<ToastAction>): ReactNode =>
    slot.some && <ActionButton action={slot.val} onDismiss={onDismiss} />;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? undefined : "polite"}
      data-kind={kind}
      data-paused={paused ? "true" : "false"}
      data-swiping={swiping ? "true" : "false"}
      className="pointer-events-auto flex w-full max-w-[min(100vw-32px,560px)] items-center gap-2.5 rounded-full bg-inverse px-4 py-2.5 text-[13px] text-inverse-foreground shadow-toast cursor-pointer select-none sm:mx-auto sm:w-fit"
      style={swipeStyle}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocusWithin(true)}
      onBlur={handleBlur}
      {...handlers}
    >
      <LeadingIcon kind={kind} />
      <span className="min-w-0 truncate">{message}</span>
      {actionButton(action)}
      {actionButton(cancel)}
      {durationMs.some && (
        <CountdownRing durationMs={durationMs.val} paused={paused} onElapsed={onDismiss} />
      )}
    </div>
  );
}
