"use client";

import { useEffect, useState } from "react";
import {
  defaultSessionTitle,
  generateSessionTitle,
  SessionTitle,
  SessionTitleStyle,
} from "@/types/session-title";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";

const CoachingSessionTitle: React.FC<{
  locale: string | "us";
  style: SessionTitleStyle;
  onRender: (sessionTitle: string) => void;
}> = ({ locale, style, onRender }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState<SessionTitle>();
  
  // Get coaching session from URL path parameter
  const { currentCoachingSession } = useCurrentCoachingSession();
  
  // Get coaching relationship from simplified store
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  useEffect(() => {
    if (!currentCoachingSession || !currentCoachingRelationship) return;

    setIsLoading(false);
    const title = generateSessionTitle(
      currentCoachingSession,
      currentCoachingRelationship,
      style,
      locale
    );
    setSessionTitle(title);
    onRender(title.title);
  }, [currentCoachingSession, currentCoachingRelationship, style, locale, onRender]);

  if (isLoading) {
    return (
      <h4 className="font-semibold break-words w-full md:text-clip">
        {defaultSessionTitle().title}
      </h4>
    );
  }

  return (
    <h4 className="font-semibold break-words w-full md:text-clip">
      {sessionTitle ? sessionTitle.title : defaultSessionTitle().title}
    </h4>
  );
};

export { CoachingSessionTitle };
