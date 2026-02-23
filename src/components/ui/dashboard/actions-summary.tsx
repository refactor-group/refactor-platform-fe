"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/components/lib/utils";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";

const MAX_VISIBLE_ACTIONS = 5;

interface ActionsSummaryProps {
  /** Actions already filtered for this specific session/relationship */
  actions: AssignedActionWithContext[];
  /** Session ID for the overflow "View all actions" link */
  sessionId: string;
}

/** Returns the Tailwind color class for the status dot, matching session-action-card.tsx */
function statusDotColor(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "bg-muted-foreground";
    case ItemStatus.InProgress:
      return "bg-green-500";
    case ItemStatus.Completed:
      return "bg-primary";
    case ItemStatus.WontDo:
      return "bg-red-400";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

export function ActionsSummary({ actions, sessionId }: ActionsSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);

  const totalDue = actions.length;
  const overdueCount = actions.filter(
    (a) => a.isOverdue && a.action.status !== ItemStatus.Completed && a.action.status !== ItemStatus.WontDo
  ).length;

  // No actions — simple non-interactive line
  if (totalDue === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckSquare className="h-4 w-4" />
        <span>No actions due</span>
      </div>
    );
  }

  const visibleActions = actions.slice(0, MAX_VISIBLE_ACTIONS);
  const overflowCount = totalDue - MAX_VISIBLE_ACTIONS;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
        <CheckSquare className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium">
            {totalDue} {totalDue === 1 ? "action" : "actions"}
          </span>{" "}
          due
          {overdueCount > 0 && (
            <>
              {" "}
              <span className="font-semibold">
                &middot; {overdueCount} overdue
              </span>
            </>
          )}
        </span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 ml-6 space-y-1.5">
          {visibleActions.map((a) => {
            const isCompleted =
              a.action.status === ItemStatus.Completed ||
              a.action.status === ItemStatus.WontDo;
            const isOverdueItem = a.isOverdue && !isCompleted;

            return (
              <div
                key={a.action.id}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  isCompleted && "opacity-60"
                )}
              >
                {/* Status dot */}
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full shrink-0",
                    isOverdueItem ? "bg-red-500" : statusDotColor(a.action.status)
                  )}
                />
                {/* Action body */}
                <span
                  className={cn(
                    "truncate text-muted-foreground",
                    isOverdueItem && "font-semibold",
                    isCompleted && "line-through"
                  )}
                >
                  {a.action.body || "Untitled action"}
                </span>
              </div>
            );
          })}

          {/* Overflow link */}
          {overflowCount > 0 && (
            <Link
              href={`/coaching-sessions/${sessionId}?tab=actions`}
              className="block text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            >
              + {overflowCount} more &rarr; View all actions
            </Link>
          )}

        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
