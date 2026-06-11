"use client";

import { useEffect, useState } from "react";
import type { FC } from "react";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useGoalsBySession } from "@/lib/api/goals";
import { useCoachingSessionTopicList } from "@/lib/api/coaching-session-topics";
import { useCoachingSessionMutation } from "@/lib/api/coaching-sessions";
import {
  coachingSessionTitle,
  isPastSession,
  isUnderwaySession,
} from "@/types/coaching-session";
import { Some, None, type Option } from "@/types/option";
import {
  formatDateInUserTimezoneWithTZ,
  getBrowserTimezone,
} from "@/lib/timezone-utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { getCoachName, getCoacheeName } from "@/lib/utils/relationship";
import { useEditorCache } from "./editor-cache-context";
import { EditableSessionTitle } from "./editable-session-title";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserPresence } from "@/types/presence";
import { RelationshipRole } from "@/types/relationship-role";

const CoachingSessionTitle: FC = () => {
  const { userSession } = useAuthStore((state) => state);

  const { currentCoachingSession, refresh } = useCurrentCoachingSession();
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();
  const sessionId = currentCoachingSession?.id ?? "";
  const { goals } = useGoalsBySession(sessionId || null);
  const { topics } = useCoachingSessionTopicList(sessionId);
  const { update } = useCoachingSessionMutation();
  const { presenceState } = useEditorCache();

  const session = currentCoachingSession;
  const relationship = currentCoachingRelationship;

  // Optimistic override: while a save is in flight, show the just-saved title
  // immediately instead of letting the display fall back to the stale server
  // value during the PUT + refetch window (which caused a new→old→new flash).
  const [save, setSave] = useState<
    { kind: "idle" } | { kind: "saving"; title: Option<string> }
  >({ kind: "idle" });
  const effectiveTitle =
    save.kind === "saving" ? save.title : session?.title ?? None;

  const fallback = coachingSessionTitle({ title: None, topics, goals });
  const displayedTitle = effectiveTitle.some ? effectiveTitle.val : fallback;

  useEffect(() => {
    if (session) document.title = displayedTitle;
  }, [session, displayedTitle]);

  const handleSave = async (next: string) => {
    if (!session) return;
    const title = next ? Some(next) : None;
    setSave({ kind: "saving", title });
    try {
      await update(session.id, { ...session, title });
      await refresh();
    } finally {
      setSave({ kind: "idle" });
    }
  };

  const getPresenceByRole = (
    role: RelationshipRole
  ): UserPresence | undefined => {
    if (!presenceState) return undefined;
    for (const user of presenceState.users.values()) {
      if (user.relationshipRole === role) return user;
    }
    return undefined;
  };

  if (!session || !relationship) return null;

  const coachName = getCoachName(relationship);
  const coacheeName = getCoacheeName(relationship);
  const timezone = userSession?.timezone || getBrowserTimezone();

  return (
    <div>
      <EditableSessionTitle
        title={effectiveTitle}
        fallbackTitle={fallback}
        onSave={handleSave}
      />
      <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <PresenceIndicator presence={getPresenceByRole(RelationshipRole.Coach)} />
          {coachName}
        </span>
        <span className="text-muted-foreground/40">/</span>
        <span className="inline-flex items-center gap-1.5">
          <PresenceIndicator
            presence={getPresenceByRole(RelationshipRole.Coachee)}
          />
          {coacheeName}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <span className="tabular-nums">
          {isPastSession(session) && "Held on "}
          {!isPastSession(session) &&
            !isUnderwaySession(session) &&
            "Scheduled for "}
          {formatDateInUserTimezoneWithTZ(session.date, timezone)}
        </span>
      </p>
    </div>
  );
};

export { CoachingSessionTitle };
