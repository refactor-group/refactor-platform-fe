"use client";

import { createElement, Fragment, useMemo } from "react";
import Link from "next/link";
import { DateTime } from "ts-luxon";
import { MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { cn } from "@/components/lib/utils";
import { formatDateWithTime } from "@/lib/utils/date";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { CoachingSessionTitleText } from "@/components/ui/coaching-session-title-text";
import type { Id } from "@/types/general";
import { userSessionFirstLastLettersToString } from "@/types/user-session";
import {
  SessionAction,
  sessionActionHint,
  sessionActionLabel,
  sessionActionsFor,
  type SessionActionItem,
} from "@/lib/session-actions";
import {
  isDestructive,
  sessionActionIcon,
  sessionActionTestId,
} from "@/components/ui/dashboard/session-action-meta";

export interface SessionRowProps {
  session: EnrichedCoachingSession;
  viewerId: Id;
  userTimezone: string;
  isPast: boolean;
  /** True when this row is the currently-selected one driving the
   *  right-side preview panel. */
  isSelected: boolean;
  /** Fires when the user clicks the row to select it for preview. */
  onSelect: () => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  /** Opens this session's series for editing. Coach-only, series sessions only. */
  onEditSeries: (session: EnrichedCoachingSession) => void;
  /** Hands the session up to the card so it can drive the
   *  `<DeleteSessionDialog>` and the delete mutation. Not invoked on
   *  rows where the viewer isn't a coach — the kebab item is hidden. */
  onRequestDelete: (session: EnrichedCoachingSession) => void;
  /** Hands the session up to the card, which owns the resend dialog. Coach-only. */
  onRequestResendInvite: (session: EnrichedCoachingSession) => void;
  /** Hands a series action up to the card so it can fetch the series and
   *  drive the view/delete dialogs. Only invoked for sessions that belong to
   *  a series; delete is coach-only. */
  onSeriesAction: (action: "view" | "delete", seriesId: Id) => void;
}

export function SessionRow({
  session,
  viewerId,
  userTimezone,
  isPast,
  isSelected,
  onSelect,
  onReschedule,
  onEditSeries,
  onRequestDelete,
  onRequestResendInvite,
  onSeriesAction,
}: SessionRowProps) {
  const participant = useMemo(
    () => getSessionParticipantInfo(session, viewerId),
    [session, viewerId]
  );

  const items = sessionActionsFor(session, {
    isCoach: participant?.isCoach === true,
    isPast,
    now: DateTime.now(),
  });

  const runAction = (action: SessionAction) => {
    const seriesId = session.coaching_session_series_id;
    switch (action) {
      case SessionAction.Reschedule:
        return onReschedule(session);
      case SessionAction.ViewSeries:
        if (seriesId.some) onSeriesAction("view", seriesId.val);
        return;
      case SessionAction.EditSeries:
        return onEditSeries(session);
      case SessionAction.ShareLink:
        // Fire-and-forget: the helper toasts both success and error itself.
        return void copyCoachingSessionLinkWithToast(session.id);
      case SessionAction.ResendInvite:
        return onRequestResendInvite(session);
      case SessionAction.DeleteSession:
        return onRequestDelete(session);
      case SessionAction.DeleteSeries:
        if (seriesId.some) onSeriesAction("delete", seriesId.val);
        return;
    }
  };

  const participantName = participant?.participantName ?? "Unknown";
  const participantInitials = participant
    ? userSessionFirstLastLettersToString(
        participant.firstName,
        participant.lastName
      )
    : "?";
  const dateLabel = useMemo(() => {
    // Backend returns naive ISO strings (no zone suffix) — interpret as UTC
    // before converting to the user's timezone, matching the canonical pattern
    // in `formatSessionTime` (src/lib/utils/session.ts).
    const dt = DateTime.fromISO(session.date, { zone: "utc" }).setZone(
      userTimezone
    );
    return formatDateWithTime(dt, "·", true);
  }, [session.date, userTimezone]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      className={cn(
        // Dark-mode bumps: `muted` is near-black there so /20 over a
        // near-black card barely registers — boost to /50 hover, /70
        // selected so the interaction states actually read.
        "flex items-center justify-between py-4 group transition-colors rounded-md -mx-2 px-2 cursor-pointer hover:bg-muted/20 dark:hover:bg-muted/50",
        isSelected && "bg-muted/40 dark:bg-muted/70"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      data-testid={`session-row-${session.id}`}
    >
      <div className="flex gap-3 items-center min-w-0 flex-1">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {participantInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {/* `text-[13px] font-medium text-foreground` mirrors GoalRow in the
              GoalsOverviewCard — the equivalent row primary-text style. */}
          <p className="text-[13px] font-medium text-foreground truncate">
            {participantName}
          </p>
          <CoachingSessionTitleText
            session={session}
            hideWhenFallback
            className="text-xs text-muted-foreground truncate mt-0.5"
          />
          <p className="text-xs text-muted-foreground tabular-nums truncate mt-0.5">
            {dateLabel}
          </p>
        </div>
      </div>

      {/* Right-side actions. Kebab + Join/View ride together in one block.
          Gated on `(hover: hover)` — capability, not viewport width — so
          a narrow desktop window still gets the quiet rest state, while
          touch devices (no hover) keep the actions visible by default. */}
      <div
        className={cn(
          "flex gap-1.5 shrink-0 items-center",
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:transition-opacity",
          // Keep the menu/popover affordances open while the user is
          // interacting with them — Radix sets `data-state=open` on the
          // hovered row (kebab button), so we keep the action group visible.
          "[&:has([data-state=open])]:opacity-100"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kebab is rendered unconditionally — Share link is universal so
            the menu is never empty. Reschedule and Delete render only
            when the viewer has the corresponding capability; Share link
            is always present. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Session actions"
              // `rounded-full` is what gives the hover background a circle
              // shape (Mercury's idiom) instead of the default rounded
              // square. `[&_svg]:!h-4 !w-4` defends against the
              // `buttonVariants` `[&_svg]:size-4` rule documented in
              // memory — explicit is safer than relying on the default.
              className="rounded-full h-8 w-8 text-muted-foreground/60 hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {items.map((item, i) => (
              <Fragment key={item.action}>
                {i > 0 && items[i - 1].group !== item.group && (
                  <DropdownMenuSeparator />
                )}
                <SessionActionMenuItem
                  item={item}
                  session={session}
                  onSelect={() => runAction(item.action)}
                />
              </Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link href={`/coaching-sessions/${session.id}`}>
          <Button
            variant={isPast ? "outline" : "default"}
            size="sm"
            className="text-xs h-8"
          >
            {isPast ? "View" : "Join"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

const DESTRUCTIVE_ITEM_CLASS =
  "text-destructive focus:text-destructive focus:bg-destructive/10";

function SessionActionMenuItem({
  item,
  session,
  onSelect,
}: {
  item: SessionActionItem;
  session: EnrichedCoachingSession;
  onSelect: () => void;
}) {
  const label = sessionActionLabel(item.action, session);
  const hint = sessionActionHint(item);
  // Resend invite keeps its two-line layout so a hint can sit under the label.
  const twoLine = item.action === SessionAction.ResendInvite;

  return (
    <DropdownMenuItem
      disabled={!item.enabled}
      onClick={onSelect}
      data-testid={sessionActionTestId(item.action)}
      className={cn(
        isDestructive(item.group) && DESTRUCTIVE_ITEM_CLASS,
        twoLine && "items-start"
      )}
    >
      {createElement(sessionActionIcon(item.action), {
        className: cn("mr-2 h-4 w-4", twoLine && "mt-0.5"),
      })}
      {twoLine ? (
        <div className="flex flex-col">
          <span>{label}</span>
          {hint.some && (
            <span className="text-xs text-muted-foreground">{hint.val}</span>
          )}
        </div>
      ) : (
        label
      )}
    </DropdownMenuItem>
  );
}
