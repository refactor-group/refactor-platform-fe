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
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  editorRef,
  toolbarRef,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const floatingRef = useRef<HTMLDivElement>(null);

  const checkToolbarVisibility = useCallback(() => {
    if (!toolbarRef.current || !editorRef.current || !floatingRef.current) {
      return;
    }

    const toolbarRect = toolbarRef.current.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    
    // Site header height: h-14 (56px) + pt-2 (8px) = 64px
    const siteHeaderHeight = 64;
    
    // Show floating toolbar when:
    // 1. The original toolbar's bottom edge is above the header (completely hidden)
    // 2. The editor is still visible (at least partially)
    const toolbarCompletelyHidden = toolbarRect.bottom < siteHeaderHeight;
    const editorVisible = editorRect.bottom > 0 && editorRect.top < window.innerHeight;
    
    const shouldShowFloating = toolbarCompletelyHidden && editorVisible;
    setIsVisible(shouldShowFloating);
    
    // Hide/show the original toolbar based on floating toolbar visibility
    if (toolbarRef.current) {
      toolbarRef.current.style.visibility = shouldShowFloating ? 'hidden' : 'visible';
    }
    
    // Position the floating toolbar to align with the editor
    if (shouldShowFloating && floatingRef.current) {
      const floating = floatingRef.current;
      floating.style.left = `${editorRect.left + 16}px`; // 1rem margin
      floating.style.right = 'auto';
      floating.style.width = `${editorRect.width - 32}px`; // subtract 2rem for margins
    }
  }, [toolbarRef, editorRef, floatingRef]);

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

    // Also listen to scroll events on parent containers
    let currentElement = editorRef.current?.parentElement;
    const scrollElements: Element[] = [];
    
    while (currentElement) {
      const computedStyle = window.getComputedStyle(currentElement);
      if (computedStyle.overflow === 'auto' || computedStyle.overflow === 'scroll' || 
          computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
        scrollElements.push(currentElement);
        currentElement.addEventListener('scroll', handleScroll, { passive: true });
      }
      currentElement = currentElement.parentElement;
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      scrollElements.forEach(element => {
        element.removeEventListener('scroll', handleScroll);
      });
    };
  }, [checkToolbarVisibility, editorRef]);

  return (
    <div
      ref={floatingRef}
      className={`floating-toolbar ${isVisible ? 'visible' : 'hidden'}`}
      role="toolbar"
      aria-label="Floating editor toolbar"
      style={{ display: isVisible ? 'block' : 'none' }}
    >
      <div className="floating-toolbar-content">
        <SimpleToolbar />
      </div>
    </div>
  );
};