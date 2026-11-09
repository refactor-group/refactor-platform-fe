"use client";

import { createContext, useContext, useId, useMemo } from "react";
import type { KeyboardEvent, ReactNode, RefObject, SyntheticEvent } from "react";
import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { PulsingDot, PulsingDotTone } from "@/components/ui/pulsing-dot";
import { timeOfDay } from "@/lib/session-window";
import {
  CardFooter,
  CardTense,
  cardNoteText,
  liveTopicsText,
  type CardNote,
  type CardView,
} from "@/lib/week-grid/card";
import { type Option, None, Some } from "@/types/option";
import { SessionCardMenu, type OnSessionAction } from "./session-card-menu";

export interface SessionCardHandlers {
  onAction: OnSessionAction;
  onOpen: (view: CardView) => void;
  onMove?: (view: CardView) => void;
}

export enum SessionCardLayout {
  Grid = "grid",
  Agenda = "agenda",
}

export interface SessionCardProps extends SessionCardHandlers {
  view: CardView;
  dimmed?: boolean;
  layout?: SessionCardLayout;
  /** Present where cards drag; true just after a drag, so its trailing click is ignored. */
  justDragged?: Option<RefObject<boolean>>;
}

const CARD_HINT = "Enter opens the session. Shift+F10 shows actions.";

interface CardHintIds {
  hint: string;
  filteredOut: string;
}

const CardHintContext = createContext<Option<CardHintIds>>(None);

function useCardHintIds(): CardHintIds {
  const id = useId();
  return useMemo(() => ({ hint: `${id}hint`, filteredOut: `${id}filtered` }), [id]);
}

/** Renders the cards' descriptions once for every card inside it to reference. */
export function SessionCardHint({ children }: { children: ReactNode }) {
  const ids = useCardHintIds();
  const shared = useMemo(() => Some(ids), [ids]);
  return (
    <CardHintContext.Provider value={shared}>
      <CardHintText ids={ids} />
      {children}
    </CardHintContext.Provider>
  );
}

function CardHintText({ ids }: { ids: CardHintIds }) {
  return (
    <>
      <span id={ids.hint} className="sr-only">
        {CARD_HINT}
      </span>
      {/* Hidden, so it's read only as a dimmed card's description. */}
      <span id={ids.filteredOut} hidden>
        Filtered out.
      </span>
    </>
  );
}

export function SessionCard({
  view,
  dimmed = false,
  layout = SessionCardLayout.Grid,
  justDragged = None,
  onAction,
  onOpen,
  onMove,
}: SessionCardProps) {
  const isPast = view.tense === CardTense.Past;
  const isAgenda = layout === SessionCardLayout.Agenda;
  const canMove = view.editable && view.canManage;
  const draggable = canMove && justDragged.some;
  const sharedHint = useContext(CardHintContext);
  const ownHintIds = useCardHintIds();
  const hintIds = sharedHint.some ? sharedHint.val : ownHintIds;
  const time = timeOfDay(view.start);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: view.session.id, disabled: !draggable });
  const onClick = () => {
    if (justDragged.some && justDragged.val.current) return;
    onOpen(view);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && e.target === e.currentTarget) onOpen(view);
    listeners?.onKeyDown?.(e);
  };

  return (
    <>
      <SessionCardMenu view={view} isCompact={isAgenda} onAction={onAction}>
        <div
          ref={setNodeRef}
          data-testid={`session-card-${view.session.id}`}
          data-tense={view.tense}
          data-dimmed={String(dimmed)}
          data-draggable={String(draggable)}
          tabIndex={0}
          aria-label={`${time}, ${view.name}`}
          aria-describedby={[
            ...(dimmed ? [hintIds.filteredOut] : []),
            hintIds.hint,
            ...(draggable ? [attributes["aria-describedby"]] : []),
          ].join(" ")}
          {...(draggable && { "aria-roledescription": attributes["aria-roledescription"] })}
          {...listeners}
          onClick={onClick}
          onKeyDown={onKeyDown}
          className={cn(
            "flex cursor-pointer flex-col gap-1.5 rounded-xl p-[11px] outline-none",
            layout === SessionCardLayout.Grid && "min-h-32",
            draggable && "cursor-grab",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isPast ? "bg-well" : "bg-card shadow-card",
            dimmed && "opacity-[.28]",
            isDragging && "cursor-grabbing opacity-[.35] outline-dashed outline-1 outline-faint"
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
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
            <CardFooterLine footer={view.footer} sessionId={view.session.id} />
            {isAgenda && (
              <div className="ml-auto flex items-center gap-2">
                {canMove && onMove && <CardButton label="Move" onClick={() => onMove(view)} />}
                <CardButton label="Open session" onClick={() => onOpen(view)} />
              </div>
            )}
          </div>
        </div>
      </SessionCardMenu>
      {sharedHint.none && <CardHintText ids={ownHintIds} />}
    </>
  );
}

function stopPropagation(e: SyntheticEvent) {
  e.stopPropagation();
}

function CardButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="text-[13px]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={stopPropagation}
    >
      {label}
    </Button>
  );
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
      {note.kind === "relative" ? <RelativeNote text={note.text} topicCount={note.topicCount} /> : cardNoteText(note)}
    </span>
  );
}

function RelativeNote({ text, topicCount }: { text: string; topicCount: number }) {
  return (
    <span>
      {text} ·{" "}
      <span className={cn(topicCount === 0 && "text-warning-text")}>{liveTopicsText(topicCount)}</span>
    </span>
  );
}

enum PillTone {
  Neutral = "neutral",
  Positive = "positive",
}

const PILL_TONE: Record<PillTone, string> = {
  [PillTone.Neutral]: "bg-fill text-foreground hover:bg-fill-hover",
  [PillTone.Positive]: "bg-positive-tint text-positive hover:bg-positive-wash",
};

function CardFooterPill({
  sessionId,
  tone,
  children,
}: {
  sessionId: string;
  tone: PillTone;
  children: ReactNode;
}) {
  return (
    <Link
      href={`/coaching-sessions/${sessionId}`}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
      className={cn(
        "inline-flex h-[26px] items-center gap-1 rounded-full px-2.5 text-tiny font-medium transition-colors duration-150",
        PILL_TONE[tone]
      )}
    >
      {children}
      <ArrowRight className="h-3 w-3" aria-hidden />
    </Link>
  );
}

function CardFooterLine({ footer, sessionId }: { footer: CardFooter; sessionId: string }) {
  switch (footer) {
    case CardFooter.Ready:
      return (
        <CardFooterPill sessionId={sessionId} tone={PillTone.Positive}>
          <Check className="h-3 w-3" aria-hidden />
          Ready
        </CardFooterPill>
      );
    case CardFooter.Prepare:
      return (
        <CardFooterPill sessionId={sessionId} tone={PillTone.Neutral}>
          Prepare
        </CardFooterPill>
      );
    case CardFooter.Done:
      return <span className="text-tiny font-medium text-faint">Done</span>;
    default: {
      const _exhaustive: never = footer;
      throw new Error(`Unhandled card footer: ${_exhaustive}`);
    }
  }
}
