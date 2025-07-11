"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  defaultSessionTitle,
  generateSessionTitle,
  SessionTitleStyle,
} from "@/types/session-title";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";

const CoachingSessionTitle: React.FC<{
  locale: string | "us";
  style: SessionTitleStyle;
  onRender: (sessionTitle: string) => void;
}> = ({ locale, style, onRender }) => {
  const lastRenderedTitle = useRef<string>("");
  
  // Get coaching session from URL path parameter
  const { currentCoachingSession, isLoading: sessionLoading } = useCurrentCoachingSession();
  
  // Get coaching relationship from simplified store
  const { currentCoachingRelationship, isLoading: relationshipLoading } = useCurrentCoachingRelationship();

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

  return (
    <h4 className="font-semibold break-words w-full md:text-clip">
      {displayTitle}
    </h4>
  );
};

export { CoachingSessionTitle };
