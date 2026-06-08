"use client";

import { useEffect } from "react";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useGoalByRelationship } from "@/lib/api/goals";
import { useCoachingSessionMutation } from "@/lib/api/coaching-sessions";
import {
  coachingSessionTitle,
  isPastSession,
  isUnderwaySession,
} from "@/types/coaching-session";
import { Some, None } from "@/types/option";
import {
  formatDateInUserTimezoneWithTZ,
  getBrowserTimezone,
} from "@/lib/timezone-utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useEditorCache } from "./editor-cache-context";
import { EditableSessionTitle } from "./editable-session-title";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserPresence } from "@/types/presence";
import { RelationshipRole } from "@/types/relationship-role";

const CoachingSessionTitle: React.FC<{ locale: string }> = () => {
  const { userSession } = useAuthStore((state) => state);

  const { currentCoachingSession, refresh } = useCurrentCoachingSession();
  const { currentCoachingRelationship, currentCoachingRelationshipId } =
    useCurrentCoachingRelationship();
  const { goal } = useGoalByRelationship(currentCoachingRelationshipId);
  const { update } = useCoachingSessionMutation();
  const { presenceState } = useEditorCache();

  const session = currentCoachingSession;
  const relationship = currentCoachingRelationship;

  const fallback = coachingSessionTitle({ title: None, goals: [goal] });
  const displayedTitle = session?.title.some ? session.title.val : fallback;

  useEffect(() => {
    if (session) document.title = displayedTitle;
  }, [session, displayedTitle]);

  const handleSave = async (next: string) => {
    if (!session) return;
    const title = next ? Some(next) : None;
    await update(session.id, { ...session, title });
    await refresh();
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

  const coachName =
    `${relationship.coach_first_name} ${relationship.coach_last_name}`.trim();
  const coacheeName =
    `${relationship.coachee_first_name} ${relationship.coachee_last_name}`.trim();
  const timezone = userSession?.timezone || getBrowserTimezone();

  return (
    <div>
      <EditableSessionTitle
        title={session.title}
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
