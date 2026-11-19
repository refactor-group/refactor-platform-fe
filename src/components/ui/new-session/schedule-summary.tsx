"use client";

import { ExternalLink, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { PersonAvatar } from "@/components/ui/avatar";
import type { MeetingLink } from "@/lib/hooks/use-schedule-data";
import type { SummaryModel } from "@/lib/new-session-dialog-model";
import { createsLine, meetingLine } from "@/lib/scheduling-copy";

export function ScheduleSummary({ userId, initials, firstName, count, meeting }: SummaryModel) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Scheduling will create</p>
      <div className="mt-2.5 flex items-center gap-3">
        <PersonAvatar userId={userId} initials={initials} size={36} />
        <div className="min-w-0">
          <p className="line-clamp-2 break-words text-item font-medium tabular-nums">{createsLine(count, firstName)}</p>
          <MeetingNote meeting={meeting} />
        </div>
      </div>
    </div>
  );
}

function MeetingNote({ meeting }: { meeting: MeetingLink }) {
  switch (meeting.kind) {
    case "unknown":
      return null;
    case "included":
      return <p className="truncate text-xs text-muted-foreground">{meetingLine(meeting.provider)}</p>;
    case "missing":
      return <NoMeetingLink />;
    default: {
      const _exhaustive: never = meeting;
      throw new Error(`Unhandled meeting link: ${_exhaustive}`);
    }
  }
}

// A new tab keeps the half-filled dialog; the connection refetches on return.
function NoMeetingLink() {
  return (
    <p className="mt-0.5 flex gap-1 text-xs text-warning-text">
      <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        No meeting link. Connect Google Meet or Zoom in{" "}
        <Link
          href="/settings/integrations"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:text-foreground"
        >
          Settings
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </Link>
        .
      </span>
    </p>
  );
}
