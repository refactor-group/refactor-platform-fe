"use client";

import { useCallback } from "react";
import { ResultAsync } from "neverthrow";
import type { DateTime } from "ts-luxon";
import { movedMessage } from "@/components/ui/dashboard/session-change-message";
import { useRefreshCoachingSessions } from "@/lib/hooks/use-sse-cache-invalidation";
import { useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { writeSessionMove } from "@/lib/session-move";
import { sessionStartIn } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import { AddBackPurpose } from "@/lib/api/membership-errors";
import { useNotAMemberToast } from "@/lib/hooks/use-not-a-member-toast";
import { notAMemberRefusalOf } from "@/types/membership";
import { Some } from "@/types/option";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export interface MoveSessionInput {
  session: EnrichedCoachingSession;
  name: string;
  to: DateTime;
}

const MOVE_FAILED = "Couldn't move the session · Try again";

export function useMoveSession(): (input: MoveSessionInput) => void {
  const refreshCoachingSessions = useRefreshCoachingSessions();
  const markMoved = useWeekGridStore((s) => s.markMoved);
  const unmarkMoved = useWeekGridStore((s) => s.unmarkMoved);
  const showNotAMember = useNotAMemberToast();

  return useCallback(
    ({ session, name, to }: MoveSessionInput) => {
      const failed = (error: unknown) => {
        const notAMember = notAMemberRefusalOf(error);
        if (notAMember.some) return showNotAMember(notAMember.val, AddBackPurpose.ScheduleSessions, () => Some(name));
        console.error("Failed to move coaching session:", error);
        toast.error(MOVE_FAILED);
      };
      const write = (start: DateTime) =>
        ResultAsync.fromPromise(writeSessionMove(session.id, start, session.duration_minutes), (error) => error).map(
          () => refreshCoachingSessions()
        );
      // The original start in the target's zone, so Undo writes back the same instant.
      const undo = () =>
        void write(sessionStartIn(session.date, to.zoneName ?? "utc")).match(() => unmarkMoved(session.id), failed);

      void write(to).match(
        () => {
          markMoved(session.id);
          toast(movedMessage(name, to), { action: { label: "Undo", onClick: undo } });
        },
        failed
      );
    },
    [refreshCoachingSessions, markMoved, unmarkMoved, showNotAMember]
  );
}
