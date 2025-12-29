import { useEffect, useRef } from "react";
import type { CarouselApi } from "@/components/ui/carousel";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { calculateSessionUrgency } from "@/lib/sessions/session-utils";
import { SessionUrgency } from "@/types/session-display";

/**
 * Custom hook for auto-scrolling carousel to the next upcoming session
 *
 * On initial load, automatically scrolls the carousel to the first non-past session.
 * This only happens once per component lifetime to avoid disrupting user navigation.
 *
 * The hook:
 * 1. Reinitializes the carousel when sessions data changes
 * 2. Finds the first session that hasn't already occurred
 * 3. Scrolls to that session (only on the first load)
 *
 * @param api - The carousel API instance
 * @param sessions - Array of enriched coaching sessions
 *
 * @example
 * ```tsx
 * const carousel = useCarouselState();
 * const { sessions } = useTodaysSessions();
 *
 * useSessionAutoScroll(carousel.api, sessions);
 *
 * return (
 *   <Carousel setApi={carousel.setApi}>
 *     {sessions.map(session => <CarouselItem key={session.id}>...</CarouselItem>)}
 *   </Carousel>
 * );
 * ```
 */
export function useSessionAutoScroll(
  api: CarouselApi | undefined,
  sessions: EnrichedCoachingSession[] | undefined
): void {
  /** Tracks whether auto-scroll to next session has occurred (should only happen once) */
  const hasAutoScrolled = useRef(false);

  /**
   * Reinitialize carousel when sessions change and auto-scroll to next upcoming session
   *
   * This effect:
   * 1. Reinitializes the carousel to pick up any new slides after data changes
   * 2. On INITIAL load only, auto-scrolls to the first non-past session
   * 3. Uses a ref to ensure auto-scroll only happens once per component lifetime
   *
   * The setTimeout ensures carousel reInit completes before attempting to scroll.
   */
  useEffect(() => {
    if (!api || !sessions || sessions.length === 0) return;

    // Reinitialize the carousel to pick up any new slides
    api.reInit();

    // Only auto-scroll to first non-past session on INITIAL load
    if (!hasAutoScrolled.current) {
      const currentOrNextIndex = sessions.findIndex(session => {
        const urgency = calculateSessionUrgency(session);
        return urgency !== SessionUrgency.Past;
      });

      if (currentOrNextIndex !== -1 && currentOrNextIndex !== 0) {
        hasAutoScrolled.current = true;
        // Use setTimeout to ensure reInit completes before scrolling
        setTimeout(() => {
          api.scrollTo(currentOrNextIndex, false);
        }, 50);
      }
    }
  }, [api, sessions]);
}
