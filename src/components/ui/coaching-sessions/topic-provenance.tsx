"use client";

import { type JSX } from "react";
import { DateTime } from "ts-luxon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { CalendarClock } from "lucide-react";
import { cn } from "@/components/lib/utils";
import {
  isTopicNew,
  topicWasUpdated,
  type LastViewedAnchor,
} from "@/types/coaching-session-topic";
import type { Id } from "@/types/general";

export interface TopicAuthorBadgeProps {
  authorName: string;
  authorId: Id;
  viewerId: Id;
  createdAt: DateTime;
  updatedAt: DateTime;
  viewedAnchor: LastViewedAnchor;
  /** Topic the backend moved here from a prior session (deferral). */
  isMovedOver?: boolean;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

const relTime = (dt: DateTime): string => dt.toRelative() ?? "";
const absTime = (dt: DateTime): string => dt.toFormat("LLL d, yyyy · h:mm a");

export function TopicAuthorBadge({
  authorName,
  authorId,
  viewerId,
  createdAt,
  updatedAt,
  viewedAnchor,
  isMovedOver = false,
}: TopicAuthorBadgeProps): JSX.Element {
  const isNew = isTopicNew(
    { user_id: authorId, created_at: createdAt },
    viewerId,
    viewedAnchor
  );
  const showUpdated = topicWasUpdated({
    created_at: createdAt,
    updated_at: updatedAt,
  });
  const fallback = initials(authorName);

  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="relative mt-0.5 inline-flex shrink-0">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
              {fallback}
            </AvatarFallback>
          </Avatar>
          {isNew && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-violet-500 ring-2 ring-card">
              <span className="sr-only">New since your last visit</span>
            </span>
          )}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" side="top" className="w-60 p-3">
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-muted text-[10px] font-medium text-muted-foreground">
              {fallback}
            </AvatarFallback>
          </Avatar>
          <p className="text-sm font-medium">{authorName}</p>
        </div>
        <div className="mt-2.5 space-y-0.5 text-[11px] text-muted-foreground tabular-nums">
          <p title={absTime(createdAt)}>Added {relTime(createdAt)}</p>
          {showUpdated && (
            <p title={absTime(updatedAt)}>Updated {relTime(updatedAt)}</p>
          )}
        </div>
        {isNew && (
          <p
            className={cn(
              "mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium",
              "text-violet-600 dark:text-violet-400"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            New since your last visit
          </p>
        )}
        {isMovedOver && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
            <CalendarClock className="h-3 w-3" />
            Moved from a previous session
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
