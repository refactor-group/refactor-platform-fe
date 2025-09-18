// Core navigation drawer state management types

export enum NavigationDrawerState {
  Expanded = 'expanded',
  Collapsed = 'collapsed'
}

export enum ScreenSize {
  Mobile = 'mobile',
  Tablet = 'tablet',
  Desktop = 'desktop'
}

export enum StateChangeSource {
  UserAction = 'user_action',
  ResponsiveResize = 'responsive_resize',
  AuthenticationChange = 'authentication_change',
  SystemInitialization = 'system_initialization'
}

export enum SidebarVariant {
  Sidebar = 'sidebar',
  Floating = 'floating',
  Inset = 'inset'
}

export enum SidebarSide {
  Left = 'left',
  Right = 'right'
}

export enum SidebarCollapsible {
  Offcanvas = 'offcanvas',
  Icon = 'icon',
  None = 'none'
}

export enum SidebarMenuSize {
  Small = 'sm',
  Default = 'default',
  Large = 'lg'
}

export enum SidebarMenuVariant {
  Default = 'default',
  Outline = 'outline'
}

// Core state interfaces
export interface NavigationState {
  userIntent: NavigationDrawerState
  currentState: NavigationDrawerState
  isResponsiveOverride: boolean
  screenSize: ScreenSize
  lastChangeSource: StateChangeSource
}

export interface StateChangeEvent {
  source: StateChangeSource
  previousState: NavigationState
  newState: NavigationState
  shouldPersist: boolean
}

// Hook and component interfaces
export interface NavigationDrawerContextProps {
  // Core state with enum types
  state: NavigationDrawerState
  userIntent: NavigationDrawerState
  isResponsiveOverride: boolean

  // Screen size awareness
  screenSize: ScreenSize
  isMobile: boolean

  // Actions with typed parameters
  setUserIntent: (intent: NavigationDrawerState, source: StateChangeSource) => void
  toggle: (source: StateChangeSource) => void
  expand: (source: StateChangeSource) => void
  collapse: (source: StateChangeSource) => void

  // Mobile-specific
  openMobile: boolean
  setOpenMobile: (open: boolean) => void

  // Internal handlers
  handleScreenSizeChange: (newSize: ScreenSize) => void
  handleAuthenticationChange: (isAuthenticated: boolean) => void
}

// Legacy compatibility types for migration
export type LegacySidebarState = "expanded" | "collapsed"
export type LegacySidebarSide = "left" | "right"
export type LegacySidebarVariant = "sidebar" | "floating" | "inset"
export type LegacySidebarCollapsible = "offcanvas" | "icon" | "none"

// Enhanced provider props
export interface SidebarProviderProps extends React.ComponentProps<"div"> {
  // Legacy props (deprecated but supported during migration)
  /** @deprecated Use defaultState instead */
  defaultOpen?: boolean
  /** @deprecated Use state instead */
  open?: boolean
  /** @deprecated Use onStateChange instead */
  onOpenChange?: (open: boolean) => void

  // New enum-based props
  defaultState?: NavigationDrawerState
  state?: NavigationDrawerState
  onStateChange?: (state: NavigationDrawerState, source: StateChangeSource) => void

  // Enhanced features
  persistIntent?: boolean
  responsiveBreakpoints?: {
    mobile: number
    tablet: number
  }
}

// Storage and calculation interfaces
export interface StateCalculationInput {
  userIntent: NavigationDrawerState | null
  screenSize: ScreenSize
  source: StateChangeSource
}

export interface StateCalculationResult {
  currentState: NavigationDrawerState
  isResponsiveOverride: boolean
  shouldPersist: boolean
}