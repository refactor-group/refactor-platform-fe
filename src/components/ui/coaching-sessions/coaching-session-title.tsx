"use client";

import { useEffect, useMemo } from "react";
import {
  defaultSessionTitle,
  generateSessionTitle,
  SessionTitleStyle,
} from "@/types/session-title";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { isPastSession, isUnderwaySession } from "@/types/coaching-session";
import {
  formatDateInUserTimezoneWithTZ,
  getBrowserTimezone,
} from "@/lib/timezone-utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useEditorCache } from "./editor-cache-context";
import { PresenceIndicator } from "@/components/ui/presence-indicator";
import { UserPresence } from "@/types/presence";
import { RelationshipRole } from "@/types/relationship-role";

const CoachingSessionTitle: React.FC<{
  locale: string | "us";
  style: SessionTitleStyle;
}> = ({ locale, style }) => {
  const { userSession } = useAuthStore((state) => state);

  // Get coaching session from URL path parameter
  const { currentCoachingSession, isLoading: sessionLoading } =
    useCurrentCoachingSession();

  // Get coaching relationship from simplified store
  const { currentCoachingRelationship, isLoading: relationshipLoading } =
    useCurrentCoachingRelationship();

  // Get presence state from editor cache
  const { presenceState } = useEditorCache();

  // Compute session title - memoized to prevent unnecessary recalculations
  const sessionTitle = useMemo(() => {
    if (sessionLoading || relationshipLoading) return null;
    if (!currentCoachingSession || !currentCoachingRelationship) return null;

    return generateSessionTitle(
      currentCoachingSession,
      currentCoachingRelationship,
      style,
      locale
    );
  }, [
    currentCoachingSession,
    currentCoachingRelationship,
    style,
    locale,
    sessionLoading,
    relationshipLoading,
  ]);

  // Sync document title as a side effect when the computed title changes
  useEffect(() => {
    if (sessionTitle) {
      document.title = sessionTitle.title;
    }
  }, [sessionTitle]);

  const displayTitle = sessionTitle?.title || defaultSessionTitle().title;

  // Helper to get presence by role
  const getPresenceByRole = (
    role: RelationshipRole
  ): UserPresence | undefined => {
    if (!presenceState) return undefined;

    // Iterate Map directly without array conversion
    for (const user of presenceState.users.values()) {
      if (user.relationshipRole === role) {
        return user;
      }
    }
    return undefined;
  };

  // Enhanced title rendering with presence indicators
  const renderTitleWithPresence = () => {
    if (!sessionTitle || !currentCoachingRelationship) return displayTitle;

    const coachPresence = getPresenceByRole(RelationshipRole.Coach);
    const coacheePresence = getPresenceByRole(RelationshipRole.Coachee);

    // Parse the existing title format: "Coach Name / Coachee Name"
    const parts = displayTitle.split(" / ");
    if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) {
      return displayTitle; // Fallback for malformed titles or default titles
    }

    const [coachName, coacheeName] = parts;

    return (
      <span className="flex items-center gap-1">
        <PresenceIndicator presence={coachPresence} />
        <span>{coachName}</span>
        <span className="mx-2">/</span>
        <PresenceIndicator presence={coacheePresence} />
        <span>{coacheeName}</span>
      </span>
    );
  };

  return (
    <div>
      <h4 className="font-semibold break-words w-full md:text-clip">
        {renderTitleWithPresence()}
      </h4>
      {currentCoachingSession && (
        <p className="text-xs text-muted-foreground mt-1">
          {isPastSession(currentCoachingSession) && "Held on "}
          {!isPastSession(currentCoachingSession) &&
            !isUnderwaySession(currentCoachingSession) &&
            "Scheduled for "}
          {formatDateInUserTimezoneWithTZ(
            currentCoachingSession.date,
            userSession?.timezone || getBrowserTimezone()
          )}
        </p>
      )}
    </div>
  );
};

export { CoachingSessionTitle };
