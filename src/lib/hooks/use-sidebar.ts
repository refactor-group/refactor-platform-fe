"use client";

import React from "react";
import { useSidebarContext } from "@/lib/providers/sidebar-provider";

// Sidebar spec constants
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = ""; // Disabled - no keyboard shortcut for sidebar

/**
 * Hook that provides sidebar state and actions.
 * Must be used within SidebarProvider.
 *
 * @returns Object containing sidebar state, actions, and configuration
 */
export const useSidebar = () => {
  const context = useSidebarContext();

  // Keyboard shortcut for sidebar toggle is disabled to avoid conflicts with editor shortcuts
  // Previously used Ctrl/Cmd+B which conflicts with TipTap bold formatting
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // No keyboard shortcut assigned - sidebar can only be toggled via UI buttons
      if (
        SIDEBAR_KEYBOARD_SHORTCUT &&
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        context.toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [context.toggleSidebar]);

  return {
    ...context,
    // Expose constants for component usage
    SIDEBAR_WIDTH,
    SIDEBAR_WIDTH_MOBILE,
    SIDEBAR_WIDTH_ICON,
  };
};