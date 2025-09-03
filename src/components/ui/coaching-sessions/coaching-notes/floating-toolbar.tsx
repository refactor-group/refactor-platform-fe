import React, { useEffect, useState, useRef, useCallback } from "react";
import { SimpleToolbar } from "./simple-toolbar";

interface FloatingToolbarProps {
  /**
   * Reference to the main editor container to detect scroll position
   */
  editorRef: React.RefObject<HTMLDivElement>;
  /**
   * Reference to the original toolbar to detect when it's out of view
   */
  toolbarRef: React.RefObject<HTMLDivElement>;
  /**
   * Height of the site header in pixels. Defaults to 64px (h-14 + pt-2)
   */
  headerHeight?: number;
  /**
   * Callback to notify parent when original toolbar visibility should change
   */
  onOriginalToolbarVisibilityChange?: (visible: boolean) => void;
}

// ============================================================================
// TOP LEVEL: Story-driven main component
// ============================================================================

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

// ============================================================================
// MIDDLE LEVEL: Logical operation hooks
// ============================================================================

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

const useScrollEventManagement = (
  editorRef: React.RefObject<HTMLDivElement>,
  onScroll: () => void
) => {
  useEffect(() => {
    // Initial check
    onScroll();
    
    // Setup event listeners
    const cleanup = setupAllScrollListeners(editorRef, onScroll);
    
    // Cleanup on unmount or dependency change
    return cleanup;
  }, [editorRef, onScroll]);
};

// ============================================================================
// LOW LEVEL: Specific implementation details
// ============================================================================

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

const setupAllScrollListeners = (
  editorRef: React.RefObject<HTMLDivElement>,
  onScroll: () => void
): (() => void) => {
  const listeners: Array<{ element: Element | Window; handler: () => void }> = [];
  
  // Global listeners
  const handleScroll = () => onScroll();
  const handleResize = () => onScroll();
  
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize, { passive: true });
  
  listeners.push(
    { element: window, handler: handleScroll },
    { element: window, handler: handleResize }
  );
  
  // Parent container listeners
  let currentElement = editorRef.current?.parentElement;
  
  while (currentElement) {
    if (isScrollableElement(currentElement)) {
      const elementHandler = () => onScroll();
      currentElement.addEventListener("scroll", elementHandler, { passive: true });
      listeners.push({ element: currentElement, handler: elementHandler });
    }
    currentElement = currentElement.parentElement;
  }
  
  // Return cleanup function
  return () => {
    // Remove window listeners
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", handleResize);
    
    // Remove element listeners
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
      <SimpleToolbar containerRef={editorRef} />
    </div>
  </div>
);