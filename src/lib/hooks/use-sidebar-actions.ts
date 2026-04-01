import { useCallback } from "react";
import {
  SidebarState,
  StateChangeSource,
  SidebarStateHookProps,
} from "@/types/sidebar";

/**
 * Custom hook that creates sidebar action handlers
 * Encapsulates the logic for managing sidebar open/close state
 */
export function useSidebarActions(
  sidebarState: SidebarStateHookProps,
  onStateChange?: (state: SidebarState, source: StateChangeSource) => void
) {
  const open = sidebarState.state === SidebarState.Expanded;

  // Destructure stable callbacks from sidebarState so useCallback deps
  // are individual references (not the whole object, which is new every render).
  const {
    setUserIntent,
    toggle,
    isMobile,
    openMobile,
    setOpenMobile,
    expand: stateExpand,
    collapse: stateCollapse,
  } = sidebarState;

  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = resolveOpenState(value, open);
      const newState = convertToSidebarState(openState);
      setUserIntent(newState, StateChangeSource.UserAction);
      onStateChange?.(newState, StateChangeSource.UserAction);
    },
    [open, setUserIntent, onStateChange]
  );

  const toggleSidebar = useCallback(() => {
    return isMobile
      ? setOpenMobile(!openMobile)
      : toggle(StateChangeSource.UserAction);
  }, [isMobile, openMobile, setOpenMobile, toggle]);

  const expand = useCallback(() => {
    stateExpand(StateChangeSource.UserAction);
  }, [stateExpand]);

  const collapse = useCallback(() => {
    stateCollapse(StateChangeSource.UserAction);
  }, [stateCollapse]);

  return { open, setOpen, toggleSidebar, expand, collapse };
}

// Helper functions for the hook

function resolveOpenState(value: boolean | ((value: boolean) => boolean), currentOpen: boolean): boolean {
  return typeof value === "function" ? value(currentOpen) : value;
}

function convertToSidebarState(openState: boolean): SidebarState {
  return openState ? SidebarState.Expanded : SidebarState.Collapsed;
}

