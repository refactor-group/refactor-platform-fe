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

  const setOpen = useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = resolveOpenState(value, open);
      const newState = convertToSidebarState(openState);
      updateSidebarState(sidebarState, newState, onStateChange);
    },
    [open, sidebarState, onStateChange]
  );

  const toggleSidebar = useCallback(() => {
    return handleSidebarToggle(sidebarState);
  }, [sidebarState]);

  const expand = useCallback(() => {
    sidebarState.expand(StateChangeSource.UserAction);
  }, [sidebarState]);

  const collapse = useCallback(() => {
    sidebarState.collapse(StateChangeSource.UserAction);
  }, [sidebarState]);

  return { open, setOpen, toggleSidebar, expand, collapse };
}

// Helper functions for the hook

function resolveOpenState(value: boolean | ((value: boolean) => boolean), currentOpen: boolean): boolean {
  return typeof value === "function" ? value(currentOpen) : value;
}

function convertToSidebarState(openState: boolean): SidebarState {
  return openState ? SidebarState.Expanded : SidebarState.Collapsed;
}

function updateSidebarState(
  sidebarState: SidebarStateHookProps,
  newState: SidebarState,
  onStateChange?: (state: SidebarState, source: StateChangeSource) => void
) {
  sidebarState.setUserIntent(newState, StateChangeSource.UserAction);
  onStateChange?.(newState, StateChangeSource.UserAction);
}

function handleSidebarToggle(sidebarState: SidebarStateHookProps) {
  return sidebarState.isMobile
    ? sidebarState.setOpenMobile(!sidebarState.openMobile)
    : sidebarState.toggle(StateChangeSource.UserAction);
}