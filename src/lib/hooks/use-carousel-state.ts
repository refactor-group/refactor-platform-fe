import { useState, useEffect } from "react";
import type { CarouselApi } from "@/components/ui/carousel";

/**
 * State returned by the useCarouselState hook
 */
export interface CarouselState {
  /** Carousel API instance for programmatic control */
  api: CarouselApi | undefined;
  /** Setter for the carousel API instance */
  setApi: (api: CarouselApi | undefined) => void;
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
 * Custom hook for managing carousel state
 *
 * Tracks carousel state including current slide, total count, and navigation
 * availability. Listens to carousel events and updates state accordingly.
 *
 * @returns Carousel state object with API instance and current state
 *
 * @example
 * ```tsx
 * const carousel = useCarouselState();
 *
 * return (
 *   <Carousel setApi={carousel.setApi}>
 *     <CarouselContent>
 *       {items.map((item) => <CarouselItem key={item.id}>{item}</CarouselItem>)}
 *     </CarouselContent>
 *   </Carousel>
 * );
 * ```
 */
export function useCarouselState(): CarouselState {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  /**
   * Track and update carousel state
   *
   * Listens to carousel events and updates state for:
   * - Total slide count
   * - Current active slide index
   * - Previous/next button enabled states
   *
   * Registers event listeners for 'select' and 'reInit' events,
   * with proper cleanup on unmount.
   */
  useEffect(() => {
    if (!api) return;

    /**
     * Updates all carousel state based on current carousel API state
     */
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

  return {
    api,
    setApi,
    current,
    count,
    canScrollPrev,
    canScrollNext,
  };
}
