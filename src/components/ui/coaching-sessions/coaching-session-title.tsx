"use client";

import { useEffect, useState } from "react";
import {
  defaultSessionTitle,
  generateSessionTitle,
  SessionTitle,
  SessionTitleStyle,
} from "@/types/session-title";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";

const CoachingSessionTitle: React.FC<{
  locale: string | "us";
  style: SessionTitleStyle;
  onRender: (sessionTitle: string) => void;
}> = ({ locale, style, onRender }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState<SessionTitle>();
  const { currentCoachingSessionId, getCurrentCoachingSession } =
    useCoachingSessionStateStore((state) => state);
  const { currentCoachingRelationshipId, getCurrentCoachingRelationship } =
    useCoachingRelationshipStateStore((state) => state);

  const coachingSession = getCurrentCoachingSession(currentCoachingSessionId);
  const coachingRelationship = getCurrentCoachingRelationship(
    currentCoachingRelationshipId
  );

  useEffect(() => {
    if (!coachingSession || !coachingRelationship) return;

    setIsLoading(false);
    const title = generateSessionTitle(
      coachingSession,
      coachingRelationship,
      style,
      locale
    );
    setSessionTitle(title);
    onRender(title.title);
  }, [coachingSession, coachingRelationship, style, locale, onRender]);

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
