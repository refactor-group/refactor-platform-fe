"use client";

import React from "react";
import { Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Empty-state body for GoalsOverviewCard. Rendered when there is no upcoming
 * session today — without an upcoming session the card has no coachee to
 * anchor to, so it shows a neutral placeholder instead of a data view.
 */
export function GoalsOverviewCardEmpty() {
  return (
    <Card className="border shadow-none h-full flex flex-col">
      <CardContent className="p-4 sm:p-6 flex flex-col flex-1">
        <div className="flex flex-col items-center justify-center flex-1 text-center gap-3 py-4">
          <Target
            className="h-8 w-8 text-muted-foreground/40"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              No active goals to show
            </p>
            <p className="text-xs text-muted-foreground">
              When you have an upcoming session, active goals will appear here.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
