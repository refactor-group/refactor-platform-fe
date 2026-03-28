"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/components/lib/utils";

// ── Compact Flip Card (shared base for goal and agreement cards) ─────
//
// Owns all flip-card infrastructure: state, ResizeObserver height
// animation, outside-click-to-close, and container markup.
// Consumers provide domain-specific content via renderFront/renderBack.
//
// When initialEditing is true, the card skips the flip entirely and
// renders the back face directly with a zoom-in entrance animation.

export interface CompactFlipCardProps {
  renderFront: (props: { onFlip: () => void }) => ReactNode;
  renderBack: (props: {
    onDone: () => void;
    isEditing: boolean;
    onEditStart: () => void;
    onEditEnd: () => void;
  }) => ReactNode;
  className?: string;
  /** When false, the card has no flip affordance. Defaults to true. */
  canFlip?: boolean;
  /** When true, the card renders the back face directly in edit mode with a zoom-in entrance. */
  initialEditing?: boolean;
  /** Called after the dismiss animation completes when removing the card. */
  onDismiss?: () => void;
}

export function CompactFlipCard({
  renderFront,
  renderBack,
  className,
  canFlip = true,
  initialEditing = false,
  onDismiss,
}: CompactFlipCardProps) {
  // When initialEditing, skip the flip and show back face directly
  if (initialEditing) {
    return (
      <ZoomCard
        className={className}
        onDismiss={onDismiss}
        renderBack={renderBack}
      />
    );
  }

  return (
    <FlipCard
      renderFront={renderFront}
      renderBack={renderBack}
      className={className}
      canFlip={canFlip}
      onDismiss={onDismiss}
    />
  );
}

// ── Zoom Card (initial editing mode) ─────────────────────────────────

function ZoomCard({
  className,
  onDismiss,
  renderBack,
}: {
  className?: string;
  onDismiss?: () => void;
  renderBack: CompactFlipCardProps["renderBack"];
}) {
  const handleDone = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const handleEditEnd = useCallback(() => {}, []);
  const handleEditStart = useCallback(() => {}, []);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-3 shadow-sm animate-in zoom-in-95 fade-in duration-300",
        className
      )}
    >
      {renderBack({
        onDone: handleDone,
        isEditing: true,
        onEditStart: handleEditStart,
        onEditEnd: handleEditEnd,
      })}
    </div>
  );
}

// ── Flip Card (normal mode) ──────────────────────────────────────────

function FlipCard({
  renderFront,
  renderBack,
  className,
  canFlip = true,
  onDismiss,
}: Omit<CompactFlipCardProps, "initialEditing">) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Animate container height to match the active face.
  // ResizeObserver handles body expansion on the front face and edit form on the back.
  useEffect(() => {
    const inner = cardRef.current?.querySelector(
      ".flip-card-inner"
    ) as HTMLElement | null;
    if (!inner) return;

    const measure = () => {
      const target = isFlipped ? backRef.current : frontRef.current;
      if (target) {
        inner.style.height = `${target.scrollHeight}px`;
      }
    };

    const frameId = requestAnimationFrame(measure);

    const activeFace = isFlipped ? backRef.current : frontRef.current;
    let observer: ResizeObserver | undefined;
    if (activeFace) {
      observer = new ResizeObserver(measure);
      observer.observe(activeFace);
    }

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [isFlipped, isEditing]);

  // Close the back face when clicking outside
  useEffect(() => {
    if (!isFlipped) return;

    function handlePointerDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsFlipped(false);
        setIsEditing(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isFlipped]);

  const handleFlip = useCallback(() => {
    if (canFlip) setIsFlipped(true);
  }, [canFlip]);

  const handleDone = useCallback(() => {
    setIsFlipped(false);
    setIsEditing(false);

    if (onDismiss) {
      // Wait for the flip-back transform transition (500ms) before unmounting.
      // The inner element transitions both transform and height — only listen
      // for transform so the height transition doesn't fire the callback early.
      const inner = cardRef.current?.querySelector(".flip-card-inner") as HTMLElement | null;
      if (inner) {
        const handler = (e: TransitionEvent) => {
          if (e.propertyName !== "transform") return;
          inner.removeEventListener("transitionend", handler);
          onDismiss();
        };
        inner.addEventListener("transitionend", handler);
      } else {
        onDismiss();
      }
    }
  }, [onDismiss]);

  const handleEditStart = useCallback(() => setIsEditing(true), []);
  const handleEditEnd = useCallback(() => setIsEditing(false), []);

  return (
    <div
      ref={cardRef}
      className={cn(
        "flip-card-container transition-[height] duration-500 ease-in-out",
        isFlipped && "flip-card-container--flipped",
        className
      )}
    >
      <div className="flip-card-inner">
        {/* ── Front face ─────────────────────────────────────────── */}
        <div
          ref={frontRef}
          aria-hidden={isFlipped}
          className="flip-card-face flip-card-front rounded-lg border border-border bg-background p-3 space-y-2 group/card transition-colors shadow-sm hover:border-foreground/20"
        >
          {renderFront({ onFlip: handleFlip })}
        </div>

        {/* ── Back face ──────────────────────────────────────────── */}
        <div
          ref={backRef}
          aria-hidden={!isFlipped}
          className="flip-card-face flip-card-back rounded-lg border border-border bg-background p-3 shadow-sm"
        >
          {renderBack({
            onDone: handleDone,
            isEditing,
            onEditStart: handleEditStart,
            onEditEnd: handleEditEnd,
          })}
        </div>
      </div>
    </div>
  );
}
