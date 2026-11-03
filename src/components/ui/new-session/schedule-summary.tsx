"use client";

import { PersonAvatar } from "@/components/ui/avatar";
import type { SummaryModel } from "@/lib/new-session-dialog-model";
import { createsLine, meetingLine } from "@/lib/scheduling-copy";

export function ScheduleSummary({ userId, initials, firstName, count, provider }: SummaryModel) {
  const meeting = meetingLine(provider);
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Scheduling will create</p>
      <div className="mt-2.5 flex items-center gap-3">
        <PersonAvatar userId={userId} initials={initials} size={36} />
        <div className="min-w-0">
          <p className="truncate text-item font-medium tabular-nums">{createsLine(count, firstName)}</p>
          {meeting.some && <p className="truncate text-xs text-muted-foreground">{meeting.val}</p>}
        </div>
      </div>
    </div>
  );
}
