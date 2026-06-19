"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DateTime } from "ts-luxon";
import {
  CalendarClock,
  CalendarRange,
  Link2,
  MoreVertical,
  Trash2,
} from "lucide-react";
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
import type { Id } from "@/types/general";
import { userSessionFirstLastLettersToString } from "@/types/user-session";

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
  /** Hands the session up to the card so it can drive the
   *  `<DeleteSessionDialog>` and the delete mutation. Not invoked on
   *  rows where the viewer isn't a coach — the kebab item is hidden. */
  onRequestDelete: (session: EnrichedCoachingSession) => void;
  /** Hands a series action up to the card so it can fetch the series and
   *  drive the view/edit/delete dialogs. Only invoked for sessions that
   *  belong to a series; edit/delete items are coach-only. */
  onSeriesAction: (
    action: "view" | "edit" | "delete",
    seriesId: Id
  ) => void;
}

export function SessionRow({
  session,
  viewerId,
  userTimezone,
  isPast,
  isSelected,
  onSelect,
  onReschedule,
  onRequestDelete,
  onSeriesAction,
}: SessionRowProps) {
  const participant = useMemo(
    () => getSessionParticipantInfo(session, viewerId),
    [session, viewerId]
  );

  // Reschedule remains coach-only and upcoming-only (matches prior behavior).
  // Delete is coach-only across both tabs — the cost asymmetry between
  // upcoming and previous deletions is conveyed by the dialog copy, not by
  // gating availability.
  // Share link is available to every viewer on every tab — read-only,
  // produces a URL the recipient can navigate to (the backend gates on
  // actual access). Because Share is universal, the kebab itself is
  // never empty — the dropdown is rendered unconditionally below.
  const canReschedule = !isPast && participant?.isCoach === true;
  const canDelete = participant?.isCoach === true;

  // Series actions surface only on rows whose session belongs to a series.
  // Viewing the series' sessions is open to any viewer (matches the old
  // ungated "View series"); editing/deleting the series is coach-only,
  // mirroring the Reschedule/Delete gating above. The series operations
  // target the whole series, so they aren't upcoming-gated.
  const seriesId = session.coaching_session_series_id;
  const canViewSeries = seriesId.some;
  const canManageSeries = seriesId.some && participant?.isCoach === true;

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
            {canReschedule && (
              <DropdownMenuItem
                onClick={() => onReschedule(session)}
                data-testid="session-row-reschedule"
              >
                Reschedule
              </DropdownMenuItem>
            )}
            {canViewSeries && (
              <DropdownMenuItem
                onClick={() =>
                  seriesId.some && onSeriesAction("view", seriesId.val)
                }
                data-testid="session-row-view-series"
              >
                <CalendarRange className="mr-2 h-4 w-4" />
                View series
              </DropdownMenuItem>
            )}
            {canManageSeries && (
              <DropdownMenuItem
                onClick={() =>
                  seriesId.some && onSeriesAction("edit", seriesId.val)
                }
                data-testid="session-row-edit-series"
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Edit series
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              // Fire-and-forget: `copyCoachingSessionLinkWithToast`
              // surfaces both success ("link copied") and error toasts
              // itself, so the row doesn't need to handle either.
              onClick={() =>
                void copyCoachingSessionLinkWithToast(session.id)
              }
              data-testid="session-row-share-link"
            >
              <Link2 className="mr-2 h-4 w-4" />
              Share link
            </DropdownMenuItem>
            {(canDelete || canManageSeries) && <DropdownMenuSeparator />}
            {canDelete && (
              <DropdownMenuItem
                onClick={() => onRequestDelete(session)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                data-testid="session-row-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete session
              </DropdownMenuItem>
            )}
            {canManageSeries && (
              <DropdownMenuItem
                onClick={() =>
                  seriesId.some && onSeriesAction("delete", seriesId.val)
                }
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                data-testid="session-row-delete-series"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete series
              </DropdownMenuItem>
            )}
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
