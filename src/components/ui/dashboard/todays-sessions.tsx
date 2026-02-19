"use client";

import React, { useEffect } from "react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TodaySessionCard } from "./today-session-card";

import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { useCarouselState } from "@/lib/hooks/use-carousel-state";
import { useSessionAutoScroll } from "@/lib/hooks/use-session-auto-scroll";
import { SessionCarouselNavigation } from "./session-carousel-navigation";
import { LoadingState, ErrorState, EmptyState } from "./todays-sessions-states";
import { useAssignedActions } from "@/lib/hooks/use-assigned-actions";

/**
 * Props for the TodaysSessions component
 */
interface TodaysSessionsProps {
  /** Optional CSS class name for styling the component container */
  className?: string;
  /** Optional callback function invoked when a user requests to reschedule a session */
  onRescheduleSession?: (session: EnrichedCoachingSession) => void;
  /** Optional callback to receive the refresh function for manually refreshing sessions */
  onRefreshNeeded?: (refreshFn: () => void) => void;
}

/**
 * TodaysSessions Component
 *
 * Displays a carousel of coaching sessions scheduled for today. Features a personalized
 * welcome message and interactive carousel navigation with automatic scrolling to the
 * next upcoming session on initial load.
 *
 * Features:
 * - Lazy-loaded session data with loading and error states
 * - Carousel-based navigation for multiple sessions
 * - Auto-scroll to first non-past session on initial load
 * - Dot indicators and arrow buttons for navigation
 * - Responsive design with accessibility support
 * - Empty state when no sessions are scheduled
 * - Optional reschedule callback for each session
 * - Refresh function exposed to parent components
 *
 * @param props - Component props
 * @returns The rendered sessions carousel with navigation, or loading/error/empty states
 *
 * @example
 * ```tsx
 * <TodaysSessions
 *   className="my-4"
 *   onRescheduleSession={(session) => handleReschedule(session)}
 *   onRefreshNeeded={(refreshFn) => setRefreshCallback(refreshFn)}
 * />
 * ```
 */
export function TodaysSessions({ className, onRescheduleSession, onRefreshNeeded }: TodaysSessionsProps) {
  // Fetch today's sessions with lazy loading
  const { sessions, isLoading, error, refresh } = useTodaysSessions();

  // Get current user for welcome message
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  // Get actions (reusing logic from What's Due)
  const { flatActions } = useAssignedActions();

  // Manage carousel state and behavior
  const carousel = useCarouselState();
  useSessionAutoScroll(carousel.api, sessions);

  /**
   * Pass refresh function to parent component
   *
   * Must be in useEffect to avoid calling setState during render phase.
   * This allows the parent component to trigger a manual refresh of the sessions list.
   */
  useEffect(() => {
    onRefreshNeeded?.(refresh);
  }, [onRefreshNeeded, refresh]);

  // Show loading state
  if (isLoading) {
    return <LoadingState firstName={userSession?.first_name} className={className} />;
  }

  // Show error state
  if (error) {
    return <ErrorState firstName={userSession?.first_name} className={className} />;
  }

  // Show empty state if no sessions
  if (sessions.length === 0) {
    return <EmptyState firstName={userSession?.first_name} className={className} />;
  }

  // Render carousel with sessions
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold">
          Today&apos;s Sessions
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <Carousel
          setApi={carousel.setApi}
          opts={{
            align: "center",
            loop: false,
            slidesToScroll: 1,
            containScroll: false,
            dragFree: false,
          }}
        >
          <CarouselContent className="py-4 !ml-0">
            {sessions.map((session, index) => (
              <CarouselItem key={session.id} className="!pl-0 pr-4">
                <TodaySessionCard
                  session={session}
                  sessionIndex={index + 1}
                  totalSessions={sessions.length}
                  assignedActions={flatActions}
                  onReschedule={onRescheduleSession ? () => onRescheduleSession(session) : undefined}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <SessionCarouselNavigation
          api={carousel.api}
          current={carousel.current}
          count={carousel.count}
          canScrollPrev={carousel.canScrollPrev}
          canScrollNext={carousel.canScrollNext}
        />
      </CardContent>
    </Card>
  );
}
