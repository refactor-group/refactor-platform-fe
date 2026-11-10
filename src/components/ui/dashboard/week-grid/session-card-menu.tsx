"use client";

import { createElement, Fragment, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/components/lib/utils";
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
  isCompact: boolean;
  onAction: OnSessionAction;
  children: ReactNode;
}

const DESTRUCTIVE_ITEM_CLASS = "text-destructive focus:text-destructive focus:bg-destructive/10";

export function SessionCardMenu({ view, isCompact, onAction, children }: SessionCardMenuProps) {
  const context: SessionActionContext = {
    isCoach: view.canManage,
    isLocked: !view.editable,
    hasStarted: view.started,
    isCompact,
  };
  const items = sessionActionsFor(view.session, context);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
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
      data-testid={sessionActionTestId(item.action)}
      className={cn(isDestructive(item.group) && DESTRUCTIVE_ITEM_CLASS)}
    >
      {createElement(sessionActionIcon(item.action), { className: "mr-2 h-4 w-4" })}
      {label}
    </ContextMenuItem>
  );
}
