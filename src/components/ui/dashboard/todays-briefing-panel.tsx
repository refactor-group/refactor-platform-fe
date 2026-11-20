"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { useNow } from "@/lib/hooks/use-now";
import { useUserTimezone } from "@/lib/hooks/use-user-timezone";
import { formatWeekdayDate } from "@/lib/utils/date";

/** The dashboard's bordered briefing: title, today's date, and its cards in a two-column grid. */
export function TodaysBriefingPanel({ children }: { children: ReactNode }) {
  const titleId = useId();
  const timezone = useUserTimezone();
  const now = useNow(60_000);
  const date = formatWeekdayDate(now.setZone(timezone));

  return (
    <section aria-labelledby={titleId} className="rounded-card border bg-card p-5 sm:p-7">
      <h2 id={titleId} className="text-section">
        Today&apos;s Briefing
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{date}</p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        {children}
      </div>
    </section>
  );
}
