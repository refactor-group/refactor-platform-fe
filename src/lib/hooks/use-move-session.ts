"use client";

import { useCallback } from "react";
import { ResultAsync } from "neverthrow";
import { useSWRConfig } from "swr";
import type { DateTime } from "ts-luxon";
import { movedMessage } from "@/components/ui/dashboard/session-change-message";
import { revalidateEndpointCaches } from "@/lib/hooks/use-sse-cache-invalidation";
import { useWeekGridStore } from "@/lib/providers/week-grid-store-provider";
import { writeSessionMove } from "@/lib/session-move";
import { sessionStartIn } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import { siteConfig } from "@/site.config";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export interface MoveSessionInput {
  session: EnrichedCoachingSession;
  name: string;
  to: DateTime;
}

const MOVE_FAILED = "Couldn't move the session · Try again";

export function useMoveSession(): (input: MoveSessionInput) => void {
  const { mutate } = useSWRConfig();
  const markMoved = useWeekGridStore((s) => s.markMoved);
  const unmarkMoved = useWeekGridStore((s) => s.unmarkMoved);

  return useCallback(
    ({ session, name, to }: MoveSessionInput) => {
      const write = (start: DateTime) =>
        ResultAsync.fromPromise(writeSessionMove(session, start, session.duration_minutes), (error) => error).map(
          () => void revalidateEndpointCaches(mutate, siteConfig.env.backendServiceURL, "/coaching_sessions")
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
    [mutate, markMoved, unmarkMoved]
  );
}

function failed(error: unknown) {
  console.error("Failed to move coaching session:", error);
  toast.error(MOVE_FAILED);
}
