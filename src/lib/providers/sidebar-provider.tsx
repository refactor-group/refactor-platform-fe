"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  forwardRef,
  useCallback,
  CSSProperties,
} from "react";
import {
  NavigationDrawerState,
  StateChangeSource,
  SidebarProviderProps as BaseSidebarProviderProps,
} from "@/types/sidebar";
import { useSidebarState } from "@/lib/hooks/use-sidebar-state";
import { cn } from "@/components/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

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
    const sidebarState = useSidebarState();

    const open = sidebarState.state === NavigationDrawerState.Expanded;
    const setOpen = useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
        const openState = typeof value === "function" ? value(open) : value;
        const newState = openState
          ? NavigationDrawerState.Expanded
          : NavigationDrawerState.Collapsed;
        sidebarState.setUserIntent(newState, StateChangeSource.UserAction);
        onStateChange?.(newState, StateChangeSource.UserAction);
      },
      [open, sidebarState, onStateChange]
    );

    const toggleSidebar = useCallback(() => {
      return sidebarState.isMobile
        ? sidebarState.setOpenMobile(!sidebarState.openMobile)
        : sidebarState.toggle(StateChangeSource.UserAction);
    }, [sidebarState]);

    // Expand/collapse helpers
    const expand = useCallback(() => {
      sidebarState.expand(StateChangeSource.UserAction);
    }, [sidebarState]);

    const collapse = useCallback(() => {
      sidebarState.collapse(StateChangeSource.UserAction);
    }, [sidebarState]);

    const contextValue: SidebarContextProps = {
      state: sidebarState.state,
      userIntent: sidebarState.userIntent,
      isResponsiveOverride: sidebarState.isResponsiveOverride,
      open,
      setOpen,
      openMobile: sidebarState.openMobile,
      setOpenMobile: sidebarState.setOpenMobile,
      isMobile: sidebarState.isMobile,
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
              } as CSSProperties
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
