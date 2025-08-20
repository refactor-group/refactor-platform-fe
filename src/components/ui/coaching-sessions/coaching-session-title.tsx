"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  defaultSessionTitle,
  generateSessionTitle,
  SessionTitleStyle,
} from "@/types/session-title";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { isPastSession } from "@/types/coaching-session";
import { formatDateInUserTimezoneWithTZ, getBrowserTimezone } from "@/lib/timezone-utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useEditorCache } from './editor-cache-context';
import { PresenceIndicator } from '@/components/ui/presence-indicator';
import { UserPresence } from '@/types/presence';

const CoachingSessionTitle: React.FC<{
  locale: string | "us";
  style: SessionTitleStyle;
  onRender: (sessionTitle: string) => void;
}> = ({ locale, style, onRender }) => {
  const { userSession } = useAuthStore((state) => state);
  const lastRenderedTitle = useRef<string>("");
  
  // Get coaching session from URL path parameter
  const { currentCoachingSession, isLoading: sessionLoading } = useCurrentCoachingSession();
  
  // Get coaching relationship from simplified store
  const { currentCoachingRelationship, isLoading: relationshipLoading } = useCurrentCoachingRelationship();
  
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
  }, [currentCoachingSession, currentCoachingRelationship, style, locale, sessionLoading, relationshipLoading]);

  // Only call onRender when the title actually changes
  useEffect(() => {
    if (sessionTitle && sessionTitle.title !== lastRenderedTitle.current) {
      lastRenderedTitle.current = sessionTitle.title;
      onRender(sessionTitle.title);
    }
  }, [sessionTitle, onRender]);

  const displayTitle = sessionTitle?.title || defaultSessionTitle().title;

  // Helper to get presence by role
  const getPresenceByRole = (role: 'coach' | 'coachee'): UserPresence | undefined => {
    if (!presenceState) return undefined;
    return Array.from(presenceState.users.values()).find(u => u.role === role);
  };

  // Enhanced title rendering with presence indicators
  const renderTitleWithPresence = () => {
    if (!sessionTitle || !currentCoachingRelationship) return displayTitle;
    
    const coachPresence = getPresenceByRole('coach');
    const coacheePresence = getPresenceByRole('coachee');
    
    // Parse the existing title format: "Coach Name <> Coachee Name"
    const parts = displayTitle.split(' <> ');
    if (parts.length !== 2) return displayTitle;
    
    const [coachName, coacheeName] = parts;
    
    return (
      <span className="flex items-center gap-1">
        <PresenceIndicator presence={coachPresence} />
        <span>{coachName}</span>
        <span className="mx-2">&lt;&gt;</span>
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
      {currentCoachingSession && isPastSession(currentCoachingSession) && (
        <p className="text-sm text-muted-foreground mt-1">
          This session was held on {formatDateInUserTimezoneWithTZ(
            currentCoachingSession.date,
            userSession?.timezone || getBrowserTimezone()
          )}
        </p>
      )}
    </div>
  );
};

export { CoachingSessionTitle };
