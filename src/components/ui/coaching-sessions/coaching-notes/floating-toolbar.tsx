import { useEffect, useState, useRef, useCallback, startTransition } from "react";
import { SimpleToolbar } from "./simple-toolbar";
import { TOOLBAR_HEIGHT_PX, TOOLBAR_SHOW_THRESHOLD, TOOLBAR_HIDE_THRESHOLD } from "./constants";

interface FloatingToolbarProps {
  /** Editor container ref for scroll detection */
  editorRef: React.RefObject<HTMLDivElement>;
  /** Original toolbar ref for visibility tracking */
  toolbarRef: React.RefObject<HTMLDivElement>;
  /** Site header height in pixels (default: 64px) */
  headerHeight?: number;
  /** Visibility change callback */
  onOriginalToolbarVisibilityChange?: (visible: boolean) => void;
}

/**
 * FloatingToolbar manages toolbar visibility based on scroll position.
 * Shows floating toolbar when original toolbar scrolls out of viewport.
 */
export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editorRef,
  toolbarRef,
  headerHeight = 64,
  onOriginalToolbarVisibilityChange,
}) => {
  const { isVisible, checkVisibility } = useToolbarVisibility(
    editorRef,
    toolbarRef,
    headerHeight,
    onOriginalToolbarVisibilityChange
  );
  
  const { floatingRef, styles } = useToolbarPositioning(editorRef, isVisible);
  
  useScrollEventManagement(editorRef, checkVisibility);
  
  return renderFloatingToolbar(floatingRef, isVisible, styles, editorRef);
};

/** Tracks toolbar visibility state based on scroll position */
const useToolbarVisibility = (
  editorRef: React.RefObject<HTMLDivElement>,
  toolbarRef: React.RefObject<HTMLDivElement>,
  headerHeight: number,
  onVisibilityChange?: (visible: boolean) => void
) => {
  const [isVisible, setIsVisible] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const checkVisibility = useCallback(() => {
    // Clear any pending debounced updates
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce visibility state changes to prevent rapid toggling
    debounceTimerRef.current = setTimeout(() => {
      const visibilityState = calculateToolbarVisibility(
        editorRef,
        toolbarRef,
        headerHeight,
        isVisible
      );
      updateVisibilityState(visibilityState, setIsVisible, onVisibilityChange);
    }, 10); // 10ms debounce delay
  }, [editorRef, toolbarRef, headerHeight, isVisible, onVisibilityChange]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return { isVisible, checkVisibility };
};

/** Calculates floating toolbar position relative to editor */
const useToolbarPositioning = (
  editorRef: React.RefObject<HTMLDivElement>,
  isVisible: boolean
) => {
  const floatingRef = useRef<HTMLDivElement>(null!);
  const [styles, setStyles] = useState(getDefaultStyles());
  const cachedStylesRef = useRef(getDefaultStyles());

  // Recalculate position on resize events only
  useEffect(() => {
    const updatePosition = () => {
      if (editorRef.current) {
        const newStyles = calculateFloatingPosition(editorRef.current);
        cachedStylesRef.current = newStyles;
        if (isVisible) {
          setStyles(newStyles);
        }
      }
    };

    // Initial calculation
    updatePosition();

    // Listen for resize events to recalculate position
    window.addEventListener("resize", updatePosition, { passive: true });

    return () => {
      window.removeEventListener("resize", updatePosition);
    };
  }, [editorRef, isVisible]);

  // Use cached styles when visibility changes (no recalculation needed)
  useEffect(() => {
    if (isVisible) {
      setStyles(cachedStylesRef.current);
    }
  }, [isVisible]);

  return { floatingRef, styles };
};

/** Manages scroll event listeners for visibility updates */
const useScrollEventManagement = (
  editorRef: React.RefObject<HTMLDivElement>,
  onScroll: () => void
) => {
  useEffect(() => {
    // Initial visibility check
    onScroll();
    
    // Setup scroll listeners on window and scrollable parents
    const cleanup = setupAllScrollListeners(editorRef, onScroll);
    
    return cleanup;
  }, [editorRef, onScroll]);
};

/** Selects appropriate threshold based on current visibility state (hysteresis) */
const selectThresholdForTransition = (currentlyVisible: boolean): number => {
  // Use different thresholds for showing vs hiding to prevent rapid toggling
  // - Show at 0.75 (75% hidden) when scrolling down
  // - Hide at 0.25 (25% hidden / 75% visible) when scrolling up
  // This creates a stable "dead zone" between transitions
  return currentlyVisible ? TOOLBAR_HIDE_THRESHOLD : TOOLBAR_SHOW_THRESHOLD;
};

/** Calculates the scroll position where toolbar transition should occur */
const calculateTransitionPoint = (
  editorTop: number,
  threshold: number
): number => {
  return editorTop + (TOOLBAR_HEIGHT_PX * threshold);
};

/** Checks if threshold point has crossed below the header */
const hasThresholdCrossedHeader = (
  thresholdPosition: number,
  headerHeight: number
): boolean => {
  return thresholdPosition < headerHeight;
};

/** Checks if editor is currently visible in viewport */
const isEditorInViewport = (editorRect: DOMRect): boolean => {
  return editorRect.bottom > 0 && editorRect.top < window.innerHeight;
};

/** Determines if floating toolbar should be shown based on editor position */
const calculateToolbarVisibility = (
  editorRef: React.RefObject<HTMLDivElement>,
  toolbarRef: React.RefObject<HTMLDivElement>,
  headerHeight: number,
  currentlyVisible: boolean
) => {
  if (!toolbarRef.current || !editorRef.current) {
    return { shouldShow: false, editorVisible: false };
  }

  const editorRect = editorRef.current.getBoundingClientRect();
  const threshold = selectThresholdForTransition(currentlyVisible);
  const thresholdPosition = calculateTransitionPoint(editorRect.top, threshold);
  const thresholdCrossed = hasThresholdCrossedHeader(thresholdPosition, headerHeight);
  const editorVisible = isEditorInViewport(editorRect);

  return {
    shouldShow: thresholdCrossed && editorVisible,
    editorVisible
  };
};

const updateVisibilityState = (
  visibilityState: { shouldShow: boolean; editorVisible: boolean },
  setIsVisible: React.Dispatch<React.SetStateAction<boolean>>,
  onVisibilityChange?: (visible: boolean) => void
) => {
  // Batch state updates using startTransition to reduce rendering overhead
  // This treats visibility changes as low-priority updates that won't block user interactions
  startTransition(() => {
    setIsVisible(visibilityState.shouldShow);

    if (onVisibilityChange) {
      onVisibilityChange(!visibilityState.shouldShow);
    }
  });
};

const getDefaultStyles = () => ({
  left: "auto",
  right: "auto", 
  width: "auto",
  minWidth: "auto",
});

const calculateFloatingPosition = (editorElement: HTMLElement) => {
  const editorRect = editorElement.getBoundingClientRect();
  
  return {
    left: `${editorRect.left + 16}px`, // 1rem margin
    right: "auto",
    width: `${editorRect.width - 32}px`,
    minWidth: "250px", // Ensure toolbar is wide enough
  };
};

/** 
 * Sets up scroll listeners on window and all scrollable parent elements.
 * Tracks scroll events to update toolbar visibility when editor position changes.
 */
const setupAllScrollListeners = (
  editorRef: React.RefObject<HTMLDivElement>,
  onScroll: () => void
): (() => void) => {
  const listeners: Array<{ element: Element | Window; handler: () => void }> = [];
  
  // Window scroll and resize handlers
  const handleScroll = () => onScroll();
  const handleResize = () => onScroll();
  
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  
  listeners.push(
    { element: window, handler: handleScroll },
    { element: window, handler: handleResize }
  );
  
  // Traverse up DOM tree to find scrollable containers
  let currentElement = editorRef.current?.parentElement;
  
  while (currentElement) {
    if (isScrollableElement(currentElement)) {
      const elementHandler = () => onScroll();
      currentElement.addEventListener("scroll", elementHandler, { passive: true });
      listeners.push({ element: currentElement, handler: elementHandler });
    }
    currentElement = currentElement.parentElement;
  }
  
  // Cleanup function removes all listeners
  return () => {
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", handleResize);
    
    listeners.forEach(({ element, handler }) => {
      if (element !== window) {
        element.removeEventListener("scroll", handler);
      }
    });
  };
};

const isScrollableElement = (element: Element): boolean => {
  const computedStyle = window.getComputedStyle(element);
  return (
    computedStyle.overflow === "auto" ||
    computedStyle.overflow === "scroll" ||
    computedStyle.overflowY === "auto" ||
    computedStyle.overflowY === "scroll"
  );
};

const renderFloatingToolbar = (
  floatingRef: React.RefObject<HTMLDivElement>,
  isVisible: boolean,
  styles: ReturnType<typeof getDefaultStyles>,
  editorRef: React.RefObject<HTMLDivElement>
) => (
  <div
    ref={floatingRef}
    className={`floating-toolbar ${isVisible ? "visible" : "hidden"}`}
    role="toolbar"
    aria-label="Floating editor toolbar"
    style={{
      display: isVisible ? "block" : "none",
      ...styles,
    }}
  >
    <div className="floating-toolbar-content">
      <SimpleToolbar />
    </div>
  </div>
);