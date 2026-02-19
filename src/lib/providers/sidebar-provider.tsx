"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  forwardRef,
  CSSProperties,
} from "react";
import {
  SidebarProviderProps as BaseSidebarProviderProps,
  SidebarContextProps as SidebarContextInterface,
} from "@/types/sidebar";
import { useSidebarState } from "@/lib/hooks/use-sidebar-state";
import { useSidebarActions } from "@/lib/hooks/use-sidebar-actions";
import { cn } from "@/components/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

export interface SidebarProviderProps extends BaseSidebarProviderProps {
  children: ReactNode;
}

// Use the interface from types file
type SidebarContextProps = SidebarContextInterface;

const SidebarContext = createContext<SidebarContextProps | null>(null);

function assertSidebarContext(
  context: SidebarContextProps | null
): asserts context is SidebarContextProps {
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
}

function buildSidebarContext(
  sidebarState: any,
  actions: ReturnType<typeof useSidebarActions>
): SidebarContextProps {
  return {
    state: sidebarState.state,
    userIntent: sidebarState.userIntent,
    isResponsiveOverride: sidebarState.isResponsiveOverride,
    screenSize: sidebarState.screenSize,
    isMobile: sidebarState.isMobile,
    openMobile: sidebarState.openMobile,
    open: actions.open,
    setUserIntent: sidebarState.setUserIntent,
    setOpen: actions.setOpen,
    toggle: sidebarState.toggle,
    toggleSidebar: actions.toggleSidebar,
    expand: actions.expand,
    collapse: actions.collapse,
    setOpenMobile: sidebarState.setOpenMobile,
    handleScreenSizeChange: sidebarState.handleScreenSizeChange,
    handleAuthenticationChange: sidebarState.handleAuthenticationChange,
  };
}

function createContainerStyle(userStyle?: React.CSSProperties): CSSProperties {
  const sidebarDimensions = getSidebarDimensions();

  return {
    "--sidebar-width": sidebarDimensions.width,
    "--sidebar-width-icon": sidebarDimensions.iconWidth,
    "--sidebar-width-mobile": sidebarDimensions.mobileWidth,
    ...userStyle,
  } as CSSProperties;
}

function renderSidebarProvider(
  contextValue: SidebarContextProps,
  style: CSSProperties,
  props: SidebarProviderProps,
  ref: React.Ref<HTMLDivElement>
) {
  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          style={style}
          className={cn(
            "group/sidebar-wrapper flex h-full w-full has-[[data-variant=inset]]:bg-sidebar",
            props.className
          )}
          ref={ref}
          {...extractContainerProps(props)}
        >
          {props.children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

// Implementation details - utility functions for the provider

function getSidebarDimensions() {
  return {
    width: "16rem",
    mobileWidth: "18rem",
    iconWidth: "3rem",
  };
}

function extractContainerProps(props: SidebarProviderProps) {
  const {
    defaultState: _defaultState,
    state: _stateProp,
    onStateChange: _onStateChange,
    persistIntent: _persistIntent,
    responsiveBreakpoints: _responsiveBreakpoints,
    className: _className,
    style: _style,
    children: _children,
    ...containerProps
  } = props;
  return containerProps;
}

export const SidebarProvider = forwardRef<HTMLDivElement, SidebarProviderProps>(
  (props, ref) => {
    const sidebarState = useSidebarState();

    const sidebarActions = useSidebarActions(sidebarState, props.onStateChange);
    const contextValue = buildSidebarContext(sidebarState, sidebarActions);
    const containerStyle = createContainerStyle(props.style);

    return renderSidebarProvider(contextValue, containerStyle, props, ref);
  }
);

SidebarProvider.displayName = "SidebarProvider";

export const useSidebarContext = (): SidebarContextProps => {
  const context = useContext(SidebarContext);
  assertSidebarContext(context);
  return context;
};
