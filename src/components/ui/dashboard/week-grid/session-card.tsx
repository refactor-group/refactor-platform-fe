"use client";

import { createContext, useContext, useId, useMemo } from "react";
import type { KeyboardEvent, ReactNode, SyntheticEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { PulsingDot, PulsingDotTone } from "@/components/ui/pulsing-dot";
import { useClickOrDoubleClick } from "@/lib/hooks/use-click-or-double-click";
import { timeOfDay } from "@/lib/session-window";
import {
  CardFooter,
  CardTense,
  cardNoteText,
  type CardNote,
  type CardView,
} from "@/lib/week-grid/card";
import { type Option, None, Some } from "@/types/option";
import { SessionCardMenu, type OnSessionAction } from "./session-card-menu";

export interface SessionCardHandlers {
  onAction: OnSessionAction;
  onSelect: (view: CardView) => void;
  onOpen: (view: CardView) => void;
}

export interface SessionCardProps extends SessionCardHandlers {
  view: CardView;
  dimmed?: boolean;
}

const CARD_HINT = "Enter opens the session. Shift+F10 shows actions.";

const CardHintContext = createContext<Option<string>>(None);

/** Renders the cards' keyboard hint once for every card inside it to reference. */
export function SessionCardHint({ children }: { children: ReactNode }) {
  const id = useId();
  const hintId = useMemo(() => Some(id), [id]);
  return (
    <CardHintContext.Provider value={hintId}>
      <CardHintText id={id} />
      {children}
    </CardHintContext.Provider>
  );
}

function CardHintText({ id }: { id: string }) {
  return (
    <span id={id} className="sr-only">
      {CARD_HINT}
    </span>
  );
}

export function SessionCard({ view, dimmed = false, onAction, onSelect, onOpen }: SessionCardProps) {
  const isPast = view.tense === CardTense.Past;
  const sharedHint = useContext(CardHintContext);
  const ownHintId = useId();
  const hintId = sharedHint.some ? sharedHint.val : ownHintId;
  const time = timeOfDay(view.start);
  const clicks = useClickOrDoubleClick(
    () => onSelect(view),
    () => onOpen(view)
  );
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && e.target === e.currentTarget) onOpen(view);
  };

  return (
    <>
      <SessionCardMenu view={view} onAction={onAction}>
        <div
          data-testid={`session-card-${view.session.id}`}
          data-tense={view.tense}
          data-dimmed={String(dimmed)}
          tabIndex={0}
          aria-label={`${time}, ${view.name}`}
          aria-describedby={hintId}
          onClick={clicks.onClick}
          onDoubleClick={clicks.onDoubleClick}
          onKeyDown={onKeyDown}
          className={cn(
            "flex min-h-[104px] flex-col gap-1.5 rounded-xl p-[11px] outline-none",
            (view.underway || (!isPast && view.canManage)) && "cursor-pointer",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isPast ? "bg-well" : "bg-card shadow-card",
            dimmed && "opacity-[.28]"
          )}
        >
          <span
            className={cn(
              "text-xs tabular-nums",
              isPast ? "text-faint" : "text-muted-foreground"
            )}
          >
            {time}
          </span>
          <span
            className={cn(
              "truncate text-[13px] font-semibold",
              isPast ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {view.name}
          </span>
          <CardNoteLine note={view.note} />
          <div className="mt-auto">
            <CardFooterLine footer={view.footer} sessionId={view.session.id} />
          </div>
        </div>
      </SessionCardMenu>
      {sharedHint.none && <CardHintText id={ownHintId} />}
    </>
  );
}

function stopPropagation(e: SyntheticEvent) {
  e.stopPropagation();
}

function CardNoteLine({ note }: { note: CardNote }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-tiny tabular-nums",
        note.kind === "noTopics" ? "text-warning-text" : "text-muted-foreground"
      )}
    >
      {note.kind === "relative" && note.pulse && (
        <PulsingDot tone={PulsingDotTone.Accent} className="h-1.5 w-1.5" />
      )}
      {cardNoteText(note)}
    </span>
  );
}

function CardFooterLine({ footer, sessionId }: { footer: CardFooter; sessionId: string }) {
  switch (footer) {
    case CardFooter.Ready:
      return (
        <span className="flex items-center gap-1 text-tiny font-medium text-positive">
          <Check className="h-3 w-3" aria-hidden />
          Ready
        </span>
      );
    case CardFooter.Prepare:
      return (
        <Link
          href={`/coaching-sessions/${sessionId}`}
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          className="inline-flex h-[26px] items-center gap-1 rounded-full bg-fill px-2.5 text-tiny font-medium text-foreground transition-colors duration-150 hover:bg-fill-hover"
        >
          Prepare
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      );
    case CardFooter.Done:
      return <span className="text-tiny font-medium text-faint">Done</span>;
    default: {
      const _exhaustive: never = footer;
      throw new Error(`Unhandled card footer: ${_exhaustive}`);
    }
  }
}
