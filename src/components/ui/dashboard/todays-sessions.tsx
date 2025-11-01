"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { TodaySessionCard } from "./today-session-card";
import { cn } from "@/components/lib/utils";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { Spinner } from "@/components/ui/spinner";

interface TodaysSessionsProps {
  className?: string;
}

export function TodaysSessions({ className }: TodaysSessionsProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const hasAutoScrolled = useRef(false);

  // Fetch today's sessions with lazy loading
  const { sessions, isLoading, error } = useTodaysSessions();

  // Get current user for welcome message
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  // Reinitialize carousel when sessions change, but only auto-scroll ONCE
  useEffect(() => {
    if (!api || !sessions || sessions.length === 0) return;

    // Reinitialize the carousel to pick up any new slides
    api.reInit();

    // Only auto-scroll to first non-past session on INITIAL load
    if (!hasAutoScrolled.current) {
      const currentOrNextIndex = sessions.findIndex(session => !session.isPast);

      if (currentOrNextIndex !== -1 && currentOrNextIndex !== 0) {
        hasAutoScrolled.current = true;
        // Use setTimeout to ensure reInit completes before scrolling
        setTimeout(() => {
          api.scrollTo(currentOrNextIndex, false);
        }, 50);
      }
    }
  }, [api, sessions]);

  // Track carousel state
  useEffect(() => {
    if (!api) return;

    const updateCarouselState = () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    updateCarouselState();
    api.on("select", updateCarouselState);
    api.on("reInit", updateCarouselState);

    // Cleanup: remove event listeners
    return () => {
      api.off("select", updateCarouselState);
      api.off("reInit", updateCarouselState);
    };
  }, [api]);

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Welcome {userSession?.first_name}!
        </h3>
        <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card className={cn("mb-8", className)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome {userSession?.first_name}!
          </CardTitle>
          <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <p className="text-destructive">
              Failed to load sessions. Please try again later.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no sessions
  if (sessions.length === 0) {
    return (
      <Card className={cn("mb-8", className)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome {userSession?.first_name}!
          </CardTitle>
          <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              No coaching sessions scheduled for today. Enjoy your day!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Section */}
      <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
        Welcome {userSession?.first_name}!
      </h3>
      <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>

      {/* Carousel Section */}
      <Carousel
        setApi={setApi}
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
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Navigation Controls Below Carousel */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!canScrollPrev}
              onClick={() => api?.scrollPrev()}
              aria-label="Previous session"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Dot Indicators */}
            <div className="flex gap-2">
              {Array.from({ length: count }).map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === current
                      ? "bg-primary w-8"
                      : "bg-muted-foreground/30 w-2"
                  )}
                  onClick={() => api?.scrollTo(index)}
                  aria-label={`Go to session ${index + 1}`}
                />
              ))}
            </div>

            {/* Next Button */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!canScrollNext}
              onClick={() => api?.scrollNext()}
              aria-label="Next session"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
        </div>
      )}

      {/* Session Counter (for accessibility) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Session {current + 1} of {count}
      </div>
    </div>
  );
}
