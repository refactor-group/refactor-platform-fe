import React, { useEffect, useState, useRef, useCallback } from "react";
import { SimpleToolbar } from "./simple-toolbar";

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
  
  const checkVisibility = useCallback(() => {
    const visibilityState = calculateToolbarVisibility(editorRef, toolbarRef, headerHeight);
    updateVisibilityState(visibilityState, setIsVisible, onVisibilityChange);
  }, [editorRef, toolbarRef, headerHeight, onVisibilityChange]);
  
  return { isVisible, checkVisibility };
};

/** Calculates floating toolbar position relative to editor */
const useToolbarPositioning = (
  editorRef: React.RefObject<HTMLDivElement>,
  isVisible: boolean
) => {
  const floatingRef = useRef<HTMLDivElement>(null!);
  const [styles, setStyles] = useState(getDefaultStyles());
  
  useEffect(() => {
    if (isVisible && editorRef.current) {
      const newStyles = calculateFloatingPosition(editorRef.current);
      setStyles(newStyles);
    }
  }, [isVisible, editorRef]);
  
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

/** Determines if floating toolbar should be shown based on editor position */
const calculateToolbarVisibility = (
  editorRef: React.RefObject<HTMLDivElement>,
  toolbarRef: React.RefObject<HTMLDivElement>,
  headerHeight: number
) => {
  if (!toolbarRef.current || !editorRef.current) {
    return { shouldShow: false, editorVisible: false };
  }
  
  const editorRect = editorRef.current.getBoundingClientRect();
  const toolbarNaturalBottom = editorRect.top;
  
  const toolbarWouldBeHidden = toolbarNaturalBottom < headerHeight;
  const editorVisible = editorRect.bottom > 0 && editorRect.top < window.innerHeight;
  
  return {
    shouldShow: toolbarWouldBeHidden && editorVisible,
    editorVisible
  };
};

const updateVisibilityState = (
  visibilityState: { shouldShow: boolean; editorVisible: boolean },
  setIsVisible: React.Dispatch<React.SetStateAction<boolean>>,
  onVisibilityChange?: (visible: boolean) => void
) => {
  setIsVisible(visibilityState.shouldShow);
  
  if (onVisibilityChange) {
    onVisibilityChange(!visibilityState.shouldShow);
  }
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