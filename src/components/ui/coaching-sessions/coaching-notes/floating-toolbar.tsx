import React, { useEffect, useState, useRef, useCallback } from "react";
import { SimpleToolbar } from "./simple-toolbar";

interface FloatingToolbarProps {
  /**
   * Reference to the main editor container to detect scroll position
   */
  editorRef: React.RefObject<HTMLElement | null>;
  /**
   * Reference to the original toolbar to detect when it's out of view
   */
  toolbarRef: React.RefObject<HTMLElement | null>;
  /**
   * Height of the site header in pixels. Defaults to 64px (h-14 + pt-2)
   */
  headerHeight?: number;
  /**
   * Callback to notify parent when original toolbar visibility should change
   */
  onOriginalToolbarVisibilityChange?: (visible: boolean) => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editorRef,
  toolbarRef,
  headerHeight = 64, // Default: h-14 (56px) + pt-2 (8px) = 64px
  onOriginalToolbarVisibilityChange,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [floatingStyles, setFloatingStyles] = useState({
    left: 'auto',
    right: 'auto',
    width: 'auto'
  });
  const floatingRef = useRef<HTMLDivElement>(null);
  const scrollListenersRef = useRef(new Map<Element, () => void>());

  const checkToolbarVisibility = useCallback(() => {
    if (!toolbarRef.current || !editorRef.current || !floatingRef.current) {
      return;
    }

    const toolbarRect = toolbarRef.current.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    
    const siteHeaderHeight = headerHeight;
    
    // Show floating toolbar when:
    // 1. The original toolbar's bottom edge is above the header (completely hidden)
    // 2. The editor is still visible (at least partially)
    const toolbarCompletelyHidden = toolbarRect.bottom < siteHeaderHeight;
    const editorVisible = editorRect.bottom > 0 && editorRect.top < window.innerHeight;
    
    const shouldShowFloating = toolbarCompletelyHidden && editorVisible;
    setIsVisible(shouldShowFloating);
    
    // Notify parent about original toolbar visibility change
    if (onOriginalToolbarVisibilityChange) {
      onOriginalToolbarVisibilityChange(!shouldShowFloating);
    }
    
    // Update floating toolbar position
    if (shouldShowFloating) {
      setFloatingStyles({
        left: `${editorRect.left + 16}px`, // 1rem margin
        right: 'auto',
        width: `${editorRect.width - 32}px` // subtract 2rem for margins
      });
    }
  }, [headerHeight, toolbarRef, editorRef, onOriginalToolbarVisibilityChange]);

  // Cleanup function to remove all tracked listeners
  const cleanupScrollListeners = useCallback(() => {
    const listeners = scrollListenersRef.current;
    listeners.forEach((handler, element) => {
      element.removeEventListener('scroll', handler);
    });
    listeners.clear();
  }, []);

  useEffect(() => {
    // Check on scroll
    const handleScroll = () => {
      checkToolbarVisibility();
    };

    // Check on resize
    const handleResize = () => {
      checkToolbarVisibility();
    };

    // Initial check
    checkToolbarVisibility();

    // Add event listeners
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Clear any existing listeners from previous renders
    cleanupScrollListeners();

    // Also listen to scroll events on parent containers
    const listeners = scrollListenersRef.current;
    let currentElement = editorRef.current?.parentElement;
    
    while (currentElement) {
      const computedStyle = window.getComputedStyle(currentElement);
      if (computedStyle.overflow === 'auto' || computedStyle.overflow === 'scroll' || 
          computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
        // Create a unique handler for each element
        const elementHandler = () => handleScroll();
        listeners.set(currentElement, elementHandler);
        currentElement.addEventListener('scroll', elementHandler, { passive: true });
      }
      currentElement = currentElement.parentElement;
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cleanupScrollListeners();
    };
  }, [checkToolbarVisibility, editorRef, cleanupScrollListeners]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScrollListeners();
    };
  }, [cleanupScrollListeners]);

  return (
    <div
      ref={floatingRef}
      className={`floating-toolbar ${isVisible ? 'visible' : 'hidden'}`}
      role="toolbar"
      aria-label="Floating editor toolbar"
      style={{ 
        display: isVisible ? 'block' : 'none',
        ...floatingStyles
      }}
    >
      <div className="floating-toolbar-content">
        <SimpleToolbar />
      </div>
    </div>
  );
};