"use client";

import React, { useState, useEffect } from "react";
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

// Mock data for prototype
const MOCK_SESSIONS = [
  {
    id: "session-1",
    goalTitle: "Q4 Product Launch Strategy",
    participantName: "Caleb Bourg",
    userRole: "Coach" as const,
    dateTime: "Today at 10:00 AM PST",
    organizationName: "Refactor Group",
    isPast: false,
    urgency: {
      type: "soon" as const,
      message: "Next session in 2 hours",
    },
  },
  {
    id: "session-2",
    goalTitle: "Career Development Goals",
    participantName: "Sarah Chen",
    userRole: "Coachee" as const,
    dateTime: "Today at 2:30 PM PST",
    organizationName: "Refactor Group",
    isPast: false,
    urgency: {
      type: "later" as const,
      message: "Scheduled for this afternoon",
    },
  },
  {
    id: "session-3",
    goalTitle: "Team Leadership & Communication",
    participantName: "Michael Rodriguez",
    userRole: "Coach" as const,
    dateTime: "Today at 4:00 PM PST",
    organizationName: "Tech Innovations Inc",
    isPast: false,
    urgency: {
      type: "later" as const,
      message: "Scheduled for this evening",
    },
  },
];

// Mock user data - replace with actual auth store data in real implementation
const MOCK_USER = {
  first_name: "Jim",
};

interface TodaysSessionsProps {
  className?: string;
}

export function TodaysSessions({ className }: TodaysSessionsProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  // Track carousel state for dot indicators
  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // Show empty state if no sessions
  if (MOCK_SESSIONS.length === 0) {
    return (
      <Card className={cn("mb-8", className)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome {MOCK_USER.first_name}!
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
        Welcome {MOCK_USER.first_name}!
      </h3>
      <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>

      {/* Carousel Section */}
      <Carousel
        setApi={setApi}
        opts={{
          align: "start",
          loop: false,
        }}
      >
        <CarouselContent className="ml-0">
          {MOCK_SESSIONS.map((session) => (
            <CarouselItem key={session.id} className="pl-0">
              <TodaySessionCard session={session} />
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
              disabled={current === 0}
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
              disabled={current === count - 1}
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
