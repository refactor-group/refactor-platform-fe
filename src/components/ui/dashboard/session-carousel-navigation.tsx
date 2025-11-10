import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/components/lib/utils";
import type { CarouselApi } from "@/components/ui/carousel";

/**
 * Props for the SessionCarouselNavigation component
 */
interface SessionCarouselNavigationProps {
  /** Carousel API instance for navigation control */
  api: CarouselApi | undefined;
  /** Current active slide index (0-based) */
  current: number;
  /** Total number of slides in the carousel */
  count: number;
  /** Whether the carousel can scroll to previous slide */
  canScrollPrev: boolean;
  /** Whether the carousel can scroll to next slide */
  canScrollNext: boolean;
}

/**
 * SessionCarouselNavigation Component
 *
 * Provides navigation controls for a carousel, including:
 * - Previous/Next arrow buttons
 * - Dot indicators for each slide
 * - Screen reader accessibility announcements
 *
 * Only renders when there is more than one slide.
 *
 * @param props - Component props
 * @returns The rendered navigation controls, or null if only one slide exists
 *
 * @example
 * ```tsx
 * const carousel = useCarouselState();
 *
 * <Carousel setApi={carousel.setApi}>
 *   <CarouselContent>...</CarouselContent>
 * </Carousel>
 *
 * <SessionCarouselNavigation
 *   api={carousel.api}
 *   current={carousel.current}
 *   count={carousel.count}
 *   canScrollPrev={carousel.canScrollPrev}
 *   canScrollNext={carousel.canScrollNext}
 * />
 * ```
 */
export function SessionCarouselNavigation({
  api,
  current,
  count,
  canScrollPrev,
  canScrollNext,
}: SessionCarouselNavigationProps) {
  // Only show navigation if there's more than one slide
  if (count <= 1) return null;

  return (
    <>
      {/* Navigation Controls */}
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

      {/* Session Counter (for accessibility) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Session {current + 1} of {count}
      </div>
    </>
  );
}
