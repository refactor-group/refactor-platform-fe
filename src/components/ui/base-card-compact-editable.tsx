"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/components/lib/utils";

// ── Base Card Compact Editable (shared base for goal and agreement cards)
//
// Owns all card infrastructure: state, ResizeObserver height
// animation, outside-click-to-close, and container markup.
// Consumers provide domain-specific content via renderFront/renderBack.
//
// When initialEditing is true, the card skips the flip entirely and
// renders the back face directly with an entrance animation.

export interface BaseCardCompactEditableProps {
  /** Optional header rendered above the body on the front face only. */
  renderHeader?: (props: { onFlip: () => void }) => ReactNode;
  renderFront: (props: { onFlip: () => void }) => ReactNode;
  /** Optional footer rendered below the body on the front face only. */
  renderFooter?: () => ReactNode;
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

export function BaseCardCompactEditable({
  renderHeader,
  renderFront,
  renderFooter,
  renderBack,
  className,
  canFlip = true,
  initialEditing = false,
  onDismiss,
}: BaseCardCompactEditableProps) {
  // When initialEditing, skip the flip and show back face directly
  if (initialEditing) {
    return (
      <InitialEditCard
        className={className}
        onDismiss={onDismiss}
        renderBack={renderBack}
      />
    );
  }

  return (
    <EditDetailsCard
      renderHeader={renderHeader}
      renderFront={renderFront}
      renderFooter={renderFooter}
      renderBack={renderBack}
      className={className}
      canFlip={canFlip}
      onDismiss={onDismiss}
    />
  );
}

// ── Initial Edit Card (skips flip, renders back face directly) ───────

function InitialEditCard({
  className,
  onDismiss,
  renderBack,
}: {
  className?: string;
  onDismiss?: () => void;
  renderBack: BaseCardCompactEditableProps["renderBack"];
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

// ── Edit Details Card (flip between read-only front and edit back) ───

function EditDetailsCard({
  renderHeader,
  renderFront,
  renderFooter,
  renderBack,
  className,
  canFlip = true,
  onDismiss,
}: Omit<BaseCardCompactEditableProps, "initialEditing">) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [pendingDismiss, setPendingDismiss] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // Animate container height to match the active face.
  // ResizeObserver handles body expansion on the front face and edit form on the back.
  useEffect(() => {
    const inner = innerRef.current;
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
        // Radix UI portals (Popover, Select, Calendar) render outside the card DOM.
        // Treat clicks inside those portals as "inside the card" so interactions
        // like assignee selection don't accidentally flip the card back.
        const target = e.target as Element;
        if (target.closest?.("[data-radix-popper-content-wrapper]")) return;

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
    if (onDismiss) setPendingDismiss(true);
  }, [onDismiss]);

  // Wait for the flip-back transform transition before dismissing.
  // Ref reads are safe inside useEffect (not during render).
  useEffect(() => {
    if (!pendingDismiss || !onDismiss) return;

    const inner = innerRef.current;
    if (!inner) {
      // No inner element — dismiss on next frame to avoid synchronous
      // setState inside an effect (react-hooks/set-state-in-effect).
      const id = requestAnimationFrame(() => {
        setPendingDismiss(false);
        onDismiss();
      });
      return () => cancelAnimationFrame(id);
    }

    const handler = (e: TransitionEvent) => {
      if (e.propertyName !== "transform") return;
      inner.removeEventListener("transitionend", handler);
      setPendingDismiss(false);
      onDismiss();
    };
    inner.addEventListener("transitionend", handler);
    return () => inner.removeEventListener("transitionend", handler);
  }, [pendingDismiss, onDismiss]);

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
      <div ref={innerRef} className="flip-card-inner">
        {/* ── Front face ─────────────────────────────────────────── */}
        <div
          ref={frontRef}
          aria-hidden={isFlipped}
          className="flip-card-face flip-card-front rounded-lg border border-border bg-background p-3 space-y-2 group/card transition-colors shadow-sm hover:border-foreground/20"
        >
          {renderHeader && (
            <div data-slot="card-header">
              {renderHeader({ onFlip: handleFlip })}
            </div>
          )}
          {renderFront({ onFlip: handleFlip })}
          {renderFooter && (
            <div data-slot="card-footer">
              {renderFooter()}
            </div>
          )}
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
