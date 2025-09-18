"use client";

import { type ReactNode, createContext, useContext, forwardRef, useCallback } from "react";
import {
  NavigationDrawerState,
  StateChangeSource,
  SidebarProviderProps as BaseSidebarProviderProps,
} from "@/types/navigation-drawer";
import { useNavigationDrawer } from "@/lib/hooks/use-navigation-drawer";
import { cn } from "@/components/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

// Enhanced provider props extending base props
export interface SidebarProviderProps extends BaseSidebarProviderProps {
  children: ReactNode;
}

// Context type for sidebar state
export type SidebarContextProps = {
  readonly state: NavigationDrawerState;
  readonly userIntent: NavigationDrawerState;
  readonly isResponsiveOverride: boolean;
  readonly open: boolean;
  setOpen: (open: boolean) => void;
  readonly openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  readonly isMobile: boolean;
  toggleSidebar: () => void;
  expand: () => void;
  collapse: () => void;
};

const SidebarContext = createContext<SidebarContextProps | null>(null);

function assertSidebarContext(
  context: SidebarContextProps | null
): asserts context is SidebarContextProps {
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
}

export const SidebarProvider = forwardRef<HTMLDivElement, SidebarProviderProps>(
  (
    {
      defaultState,
      state: stateProp,
      onStateChange,
      persistIntent = true,
      responsiveBreakpoints,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    // Use our enhanced navigation drawer hook
    const navigationDrawer = useNavigationDrawer();

    // Convert enum state to boolean for legacy compatibility
    const open = navigationDrawer.state === NavigationDrawerState.Expanded;
    const setOpen = useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value;
        const newState = openState
          ? NavigationDrawerState.Expanded
          : NavigationDrawerState.Collapsed;
        navigationDrawer.setUserIntent(newState, StateChangeSource.UserAction);
        onStateChange?.(newState, StateChangeSource.UserAction);
      },
      [open, navigationDrawer, onStateChange]
    );

    // Enhanced toggle that uses our new system with stable references
    const toggleSidebar = useCallback(() => {
      return navigationDrawer.isMobile
        ? navigationDrawer.setOpenMobile(!navigationDrawer.openMobile)
        : navigationDrawer.toggle(StateChangeSource.UserAction);
    }, [
      navigationDrawer.isMobile,
      navigationDrawer.setOpenMobile,
      navigationDrawer.toggle,
      navigationDrawer.openMobile,
    ]);

    // Expand/collapse helpers
    const expand = useCallback(() => {
      navigationDrawer.expand(StateChangeSource.UserAction);
    }, [navigationDrawer.expand]);

    const collapse = useCallback(() => {
      navigationDrawer.collapse(StateChangeSource.UserAction);
    }, [navigationDrawer.collapse]);

    const contextValue: SidebarContextProps = {
      state: navigationDrawer.state,
      userIntent: navigationDrawer.userIntent,
      isResponsiveOverride: navigationDrawer.isResponsiveOverride,
      open,
      setOpen,
      openMobile: navigationDrawer.openMobile,
      setOpenMobile: navigationDrawer.setOpenMobile,
      isMobile: navigationDrawer.isMobile,
      toggleSidebar,
      expand,
      collapse,
    };

    // Sidebar spec constants
    const SIDEBAR_WIDTH = "16rem";
    const SIDEBAR_WIDTH_MOBILE = "18rem";
    const SIDEBAR_WIDTH_ICON = "3rem";

    return (
      <SidebarContext.Provider value={contextValue}>
        <TooltipProvider delayDuration={0}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex h-full w-full has-[[data-variant=inset]]:bg-sidebar",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    );
  }
);

SidebarProvider.displayName = "SidebarProvider";

export const useSidebarContext = (): SidebarContextProps => {
  const context = useContext(SidebarContext);
  assertSidebarContext(context);
  return context;
};