"use client";

import { useEffect, type RefObject } from "react";
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
 * Height of the sticky site header (h-14 = 56px) plus a small buffer so the
 * compact title appears slightly before the page title fully scrolls away.
 */
const STICKY_HEADER_SCROLL_OFFSET_PX = 80;

/**
 * Syncs the current coaching session's title data into the StickyTitle context
 * and optionally manages scroll-based visibility via IntersectionObserver.
 *
 * @param titleRef - When provided, an IntersectionObserver is set up on this
 *   element to show/hide the sticky header title as it scrolls off-screen.
 *
 * Call this once in the coaching session page component.
 * Cleans up (sets null) on unmount so stale data doesn't linger.
 */
export function useStickyTitleSync(titleRef?: RefObject<HTMLDivElement | null>): void {
  const ctx = useStickyTitle();
  const setTitleData = ctx?.setTitleData ?? null;
  const setVisible = ctx?.setVisible ?? null;

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

  // Sync session title data into the sticky title context
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
  // Primitives used instead of object refs to avoid SWR identity-triggered re-renders
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionDate, coachFirst, coachLast, coacheeFirst, coacheeLast, timezone, setTitleData]);

  // Show/hide sticky title when the page title scrolls off-screen
  useEffect(() => {
    const el = titleRef?.current;
    if (!el || !setVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: `-${STICKY_HEADER_SCROLL_OFFSET_PX}px 0px 0px 0px` }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [titleRef, setVisible]);
}
