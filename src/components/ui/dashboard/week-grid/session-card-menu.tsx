"use client";

import { createElement, Fragment, useRef, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/components/lib/utils";
import { notAMemberText } from "@/lib/api/membership-errors";
import {
  isDestructive,
  sessionActionIcon,
  sessionActionTestId,
} from "@/components/ui/dashboard/session-action-meta";
import {
  sessionActionLabel,
  sessionActionsFor,
  type SessionAction,
  type SessionActionContext,
  type SessionActionItem,
} from "@/lib/session-actions";
import type { CardView } from "@/lib/week-grid/card";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export type OnSessionAction = (action: SessionAction, session: EnrichedCoachingSession) => void;

export interface SessionCardMenuProps {
  view: CardView;
  onAction: OnSessionAction;
  children: ReactNode;
}

// Long enough for a tap's click to follow its pointerdown.
const TAP_CLICK_WINDOW_MS = 1000;

/** On touch, the tap that closes the menu still clicks what it lands on once the menu is gone; swallow that click. */
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  document.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), TAP_CLICK_WINDOW_MS);
}

const DESTRUCTIVE_ITEM_CLASS = "text-destructive focus:text-destructive focus:bg-destructive/10";

export function SessionCardMenu({ view, onAction, children }: SessionCardMenuProps) {
  const context: SessionActionContext = {
    isCoach: view.canManage,
    isLocked: !view.editable,
    hasStarted: view.started,
    counterpartIsMember: view.counterpartIsMember,
  };
  const items = sessionActionsFor(view.session, context);
  // A closing menu still sees outside pointerdowns while it fades out; those clicks are real.
  const isOpen = useRef(false);

  return (
    <ContextMenu onOpenChange={(open) => (isOpen.current = open)}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent onPointerDownOutside={() => isOpen.current && swallowNextClick()}>
        {items.map((item, i) => (
          <Fragment key={item.action}>
            {i > 0 && items[i - 1].group !== item.group && <ContextMenuSeparator />}
            <SessionCardMenuItem
              item={item}
              label={sessionActionLabel(item.action, view.session, context)}
              onSelect={() => onAction(item.action, view.session)}
            />
          </Fragment>
        ))}
        {!view.counterpartIsMember && (
          <>
            <ContextMenuSeparator />
            <p className="max-w-56 px-2 py-1.5 text-xs text-muted-foreground">
              {notAMemberText(view.name)}
            </p>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SessionCardMenuItem({
  item,
  label,
  onSelect,
}: {
  item: SessionActionItem;
  label: string;
  onSelect: () => void;
}) {
  return (
    <ContextMenuItem
      onSelect={onSelect}
      disabled={!item.enabled}
      data-testid={sessionActionTestId(item.action)}
      className={cn(isDestructive(item.group) && DESTRUCTIVE_ITEM_CLASS)}
    >
      {createElement(sessionActionIcon(item.action), { className: "mr-2 h-4 w-4" })}
      {label}
    </ContextMenuItem>
  );
}
