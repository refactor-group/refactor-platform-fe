"use client";

import { useEffect } from "react";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useStickyTitle } from "@/lib/contexts/sticky-title-context";
import {
  generateSessionTitle,
  SessionTitleStyle,
} from "@/types/session-title";
import {
  formatDateInUserTimezoneWithTZ,
  getBrowserTimezone,
} from "@/lib/timezone-utils";
import { siteConfig } from "@/site.config";

/**
 * Syncs the current coaching session's title data into the StickyTitle context.
 * Call this once in the coaching session page component.
 * Cleans up (sets null) on unmount so stale data doesn't linger.
 */
export function useStickyTitleSync(): void {
  const ctx = useStickyTitle();
  const setTitleData = ctx?.setTitleData ?? null;

  const { currentCoachingSession } = useCurrentCoachingSession();
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();
  const { userSession } = useAuthStore((state) => state);

  // Depend on primitive fields to avoid re-running when SWR returns a new object reference
  const sessionDate = currentCoachingSession?.date;
  const coachFirst = currentCoachingRelationship?.coach_first_name;
  const coachLast = currentCoachingRelationship?.coach_last_name;
  const coacheeFirst = currentCoachingRelationship?.coachee_first_name;
  const coacheeLast = currentCoachingRelationship?.coachee_last_name;
  const timezone = userSession?.timezone;

  useEffect(() => {
    if (!setTitleData) return;

    if (!currentCoachingSession || !currentCoachingRelationship) {
      setTitleData(null);
      return;
    }

    // Generate the names portion using the existing title utility
    const sessionTitle = generateSessionTitle(
      currentCoachingSession,
      currentCoachingRelationship,
      SessionTitleStyle.CoachFirstLastCoacheeFirstLast,
      siteConfig.locale
    );

    // Generate the formatted date with timezone
    const date = formatDateInUserTimezoneWithTZ(
      currentCoachingSession.date,
      timezone || getBrowserTimezone()
    );

    setTitleData({ names: sessionTitle.title, date });

    return () => {
      setTitleData(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDate, coachFirst, coachLast, coacheeFirst, coacheeLast, timezone, setTitleData]);
}
