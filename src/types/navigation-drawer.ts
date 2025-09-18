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

// Hook and component interfaces with enhanced type safety
export interface NavigationDrawerContextProps {
  // State properties should be readonly
  readonly state: NavigationDrawerState
  readonly userIntent: NavigationDrawerState
  readonly isResponsiveOverride: boolean
  readonly screenSize: ScreenSize
  readonly isMobile: boolean
  readonly openMobile: boolean

  // Actions remain mutable
  setUserIntent: (intent: NavigationDrawerState, source: StateChangeSource) => void
  toggle: (source: StateChangeSource) => void
  expand: (source: StateChangeSource) => void
  collapse: (source: StateChangeSource) => void
  setOpenMobile: (open: boolean) => void
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

// Enhanced type safety for configuration
export enum BreakpointKey {
  Mobile = 'mobile',
  Tablet = 'tablet'
}

export type ConfigKey = `nav_drawer_${string}`

export interface TypedBreakpoints {
  readonly [BreakpointKey.Mobile]: number
  readonly [BreakpointKey.Tablet]: number
}

// Domain-specific error types
export class NavigationDrawerError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'NavigationDrawerError'
    this.code = code
  }
}

export class StorageUnavailableError extends NavigationDrawerError {
  constructor() {
    super('Session storage is not available', 'STORAGE_UNAVAILABLE')
  }
}

// Result type for better error handling
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

// Strict component prop interfaces
export interface SidebarProps {
  readonly side?: SidebarSide
  readonly variant?: SidebarVariant
  readonly collapsible?: SidebarCollapsible
  readonly className?: string
  readonly children?: React.ReactNode
}

// State transition validation
export interface StateTransition {
  readonly from: NavigationDrawerState
  readonly to: NavigationDrawerState
  readonly source: StateChangeSource
}

// Type-safe storage key factory
export function createStorageKey<T extends string>(suffix: T): `nav_drawer_${T}` {
  return `nav_drawer_${suffix}`
}