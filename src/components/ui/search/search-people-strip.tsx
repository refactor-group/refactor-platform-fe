"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import type { MenuPerson } from "@/components/ui/join-session/types";
import type { Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";

export interface StripPerson {
  person: MenuPerson;
  count: number;
}

/** Chips shown before the overflow chip when the strip can't be measured. */
export const FALLBACK_VISIBLE_CHIPS = 4;

const CHIP_GAP_PX = 6;

export const resultCountLabel = (count: number): string =>
  `${count} ${count === 1 ? "result" : "results"}`;

/**
 * How many chips fit in one row. When not all fit, room is kept for the
 * overflow chip, and at least one person chip always shows.
 */
export function chipsThatFit(
  available: number,
  chipWidths: number[],
  overflowWidth: number,
  gap: number
): number {
  const widthOf = (count: number): number =>
    chipWidths.slice(0, count).reduce((sum, width) => sum + width, 0) +
    Math.max(0, count - 1) * gap;
  if (widthOf(chipWidths.length) <= available) return chipWidths.length;
  let count = chipWidths.length - 1;
  while (count > 1 && widthOf(count) + gap + overflowWidth > available) count -= 1;
  return Math.max(1, count);
}

// cmdk's root runs the highlighted result on Enter, wherever focus is.
export const keepEnterOnButton = (event: KeyboardEvent) => {
  if (event.key === "Enter") event.stopPropagation();
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const CHIP_CLASSES = cn(
  "relative inline-flex h-[26px] flex-none items-center rounded-full bg-fill text-pill font-medium text-foreground",
  "transition-colors duration-150 hover:bg-fill-hover",
  // 44px tap target on phones around the 26px chip.
  "max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-[9px] max-md:before:content-['']",
  FOCUS_RING
);

const COUNT_CLASSES = "font-normal text-muted-foreground tabular-nums";

interface SearchPeopleStripProps {
  people: StripPerson[];
  spotlight: Option<Id>;
  onPick: (userId: Id) => void;
}

/** One chip per person with hits; the ones that don't fit sit behind a "+N" menu. */
export function SearchPeopleStrip({ people, spotlight, onPick }: SearchPeopleStripProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [measured, setMeasured] = useState<Option<number>>(None);
  const measureRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const chipsKey = people.map(({ person, count }) => `${person.userId}:${count}`).join("|");

  useEffect(() => {
    const row = measureRef.current;
    if (!row) return;
    const measure = () => {
      const widths = Array.from(row.children, (chip) => chip.getBoundingClientRect().width);
      const overflowWidth = widths.pop() ?? 0;
      // jsdom, or a hidden popover: nothing to measure, so the fallback cap applies.
      const fit =
        row.clientWidth > 0
          ? Some(chipsThatFit(row.clientWidth, widths, overflowWidth, CHIP_GAP_PX))
          : None;
      setMeasured((current) =>
        current.some === fit.some && (!fit.some || !current.some || current.val === fit.val)
          ? current
          : fit
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [chipsKey]);

  useEffect(() => {
    if (!menuOpen) return;
    // Capture, so Escape closes the menu before the field clears its query.
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.target instanceof Node && overflowRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [menuOpen]);

  const visibleCount = measured.some
    ? Math.min(measured.val, people.length)
    : Math.min(FALLBACK_VISIBLE_CHIPS, people.length);
  const shown = people.slice(0, visibleCount);
  const rest = people.slice(visibleCount);
  const isSpotlit = (userId: Id): boolean => spotlight.some && spotlight.val === userId;
  const overflowActive = menuOpen || rest.some(({ person }) => isSpotlit(person.userId));

  const pick = (userId: Id) => {
    setMenuOpen(false);
    onPick(userId);
  };

  return (
    <div
      className="relative flex items-center gap-1.5 border-b border-hairline px-1 pb-2 pt-1"
      onKeyDown={keepEnterOnButton}
    >
      {/* Every chip at its natural width, out of sight, so the row can be measured. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-1 top-0 flex gap-1.5 overflow-hidden"
      >
        {people.map(({ person, count }) => (
          <span key={person.userId} className={cn(CHIP_CLASSES, "gap-1.5 pl-[3px] pr-[9px]")}>
            <span className="h-5 w-5 flex-none" />
            {person.firstName}
            <span className={COUNT_CLASSES}>{count}</span>
          </span>
        ))}
        <span className={cn(CHIP_CLASSES, "px-[9px] tabular-nums")}>+{people.length}</span>
      </div>

      {shown.map(({ person, count }) => (
        <button
          key={person.userId}
          type="button"
          aria-pressed={isSpotlit(person.userId)}
          aria-label={`${person.fullName}, ${resultCountLabel(count)}`}
          onClick={() => pick(person.userId)}
          className={cn(CHIP_CLASSES, "gap-1.5 pl-[3px] pr-[9px] aria-pressed:bg-brand-tint")}
        >
          <PersonAvatar userId={person.userId} initials={person.initials} size={20} />
          {person.firstName}
          <span className={COUNT_CLASSES}>{count}</span>
        </button>
      ))}

      {rest.length > 0 && (
        <div ref={overflowRef} className="flex flex-none">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={`${rest.length} more ${rest.length === 1 ? "person" : "people"}`}
            onClick={() => setMenuOpen((open) => !open)}
            className={cn(CHIP_CLASSES, "px-[9px] tabular-nums", overflowActive && "bg-brand-tint")}
          >
            +{rest.length}
          </button>
          {menuOpen && (
            <div
              role="group"
              aria-label="More people"
              className="absolute right-1 top-[34px] z-10 flex max-h-[min(20rem,50vh)] w-[220px] flex-col gap-0.5 overflow-y-auto rounded-popover border bg-popover p-1.5 shadow-popover"
            >
              {rest.map(({ person, count }) => (
                <button
                  key={person.userId}
                  type="button"
                  aria-pressed={isSpotlit(person.userId)}
                  aria-label={`${person.fullName}, ${resultCountLabel(count)}`}
                  onClick={() => pick(person.userId)}
                  className={cn(
                    "flex h-9 flex-none items-center gap-2.5 rounded-lg px-2 text-left text-[13px] text-foreground",
                    "transition-colors duration-150 hover:bg-well aria-pressed:bg-brand-tint",
                    FOCUS_RING
                  )}
                >
                  <PersonAvatar userId={person.userId} initials={person.initials} size={20} />
                  <span className="min-w-0 flex-1 truncate">{person.fullName}</span>
                  <span className={COUNT_CLASSES}>{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
