"use client";

import Link from "next/link";
import { CheckSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";

interface ActionsSummaryProps {
  /** Actions already filtered for this specific session/relationship */
  actions: AssignedActionWithContext[];
  /** Session ID for navigating to the session's Actions tab */
  sessionId: string;
}

export function ActionsSummary({ actions, sessionId }: ActionsSummaryProps) {
  const activeActions = actions.filter(
    (a) => a.action.status !== ItemStatus.Completed && a.action.status !== ItemStatus.WontDo
  );
  const totalDue = activeActions.length;

  // No actions — simple non-interactive line
  if (totalDue === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckSquare className="h-4 w-4" />
        <span>No actions due</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/coaching-sessions/${sessionId}?tab=actions&review=true`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckSquare className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">
                {totalDue} {totalDue === 1 ? "action" : "actions"}
              </span>{" "}
              due assigned to you
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Click to review</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
