// Core sidebar state management types

export enum SidebarState {
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
  userIntent: SidebarState
  currentState: SidebarState
  isResponsiveOverride: boolean
  screenSize: ScreenSize
  lastChangeSource: StateChangeSource
}


// Hook interface for useSidebarState
export interface SidebarStateHookProps {
  // State properties should be readonly
  readonly state: SidebarState
  readonly userIntent: SidebarState
  readonly isResponsiveOverride: boolean
  readonly screenSize: ScreenSize
  readonly isMobile: boolean
  readonly openMobile: boolean

  // Actions remain mutable
  setUserIntent: (intent: SidebarState, source: StateChangeSource) => void
  toggle: (source: StateChangeSource) => void
  expand: (source: StateChangeSource) => void
  collapse: (source: StateChangeSource) => void
  setOpenMobile: (open: boolean) => void
  handleScreenSizeChange: (newSize: ScreenSize) => void
  handleAuthenticationChange: (isAuthenticated: boolean) => void
}

// Context interface for SidebarProvider
export interface SidebarContextProps {
  // State properties should be readonly
  readonly state: SidebarState
  readonly userIntent: SidebarState
  readonly isResponsiveOverride: boolean
  readonly screenSize: ScreenSize
  readonly isMobile: boolean
  readonly openMobile: boolean
  readonly open: boolean

  // Actions remain mutable
  setUserIntent: (intent: SidebarState, source: StateChangeSource) => void
  setOpen: (open: boolean) => void
  toggle: (source: StateChangeSource) => void
  toggleSidebar: () => void
  expand: (source: StateChangeSource) => void
  collapse: (source: StateChangeSource) => void
  setOpenMobile: (open: boolean) => void
  handleScreenSizeChange: (newSize: ScreenSize) => void
  handleAuthenticationChange: (isAuthenticated: boolean) => void
}


// Enhanced provider props
export interface SidebarProviderProps extends React.ComponentProps<"div"> {
  defaultState?: SidebarState
  state?: SidebarState
  onStateChange?: (state: SidebarState, source: StateChangeSource) => void
  persistIntent?: boolean
  responsiveBreakpoints?: {
    mobile: number
    tablet: number
  }
}

// Storage and calculation interfaces
export interface StateCalculationInput {
  userIntent: SidebarState | null
  screenSize: ScreenSize
  source: StateChangeSource
}

export interface StateCalculationResult {
  currentState: SidebarState
  isResponsiveOverride: boolean
  shouldPersist: boolean
}

// Enhanced type safety for configuration
export enum BreakpointKey {
  Mobile = 'mobile',
  Tablet = 'tablet'
}

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


// Type-safe storage key factory
export function createStorageKey<T extends string>(suffix: T): `nav_drawer_${T}` {
  return `nav_drawer_${suffix}`
}