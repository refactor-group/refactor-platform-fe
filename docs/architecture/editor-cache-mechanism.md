# TipTap Editor Cache Mechanism

## Overview

The coaching session page implements an efficient tab switching mechanism that preserves the TipTap editor state across tab navigation without recreating the expensive collaborative editor instances.

## Architecture

### EditorCacheProvider Context

**Location**: `src/components/ui/coaching-sessions/editor-cache-context.tsx`

The `EditorCacheProvider` maintains persistent instances of:
- **Y.Doc**: Collaborative document state
- **TiptapCollabProvider**: Real-time collaboration provider  
- **Extensions**: TipTap editor extensions with collaboration features
- **Cache State**: Loading, ready, and error states

#### Key Features

- **Session-Scoped Caching**: Y.Doc and provider persist for the entire coaching session
- **Automatic Cleanup**: Destroys instances when session ID changes
- **JWT Error Handling**: Falls back to non-collaborative extensions on auth failures
- **Memory Management**: Proper cleanup of event listeners and connections

### Tab Switching Optimization

**Location**: `src/components/ui/coaching-sessions/coaching-tabs-container.tsx`

Instead of unmounting tab content (which destroys React components), the implementation uses **CSS visibility control**:

```typescript
<div style={{ display: currentTab === "notes" ? "flex" : "none" }}>
  <CoachingNotes />
</div>
<div style={{ display: currentTab === "agreements" ? "block" : "none" }}>
  <AgreementsList />
</div>
<div style={{ display: currentTab === "actions" ? "block" : "none" }}>
  <ActionsList />
</div>
```

#### Benefits

- **Instant Tab Switching**: No component remounting delays
- **State Preservation**: Editor content, cursor position, and collaboration state maintained
- **Memory Efficiency**: Single Y.Doc and provider instance per session
- **Performance**: Eliminates 1-2 second reload delays

## Implementation Details

### CoachingNotes Integration

**Location**: `src/components/ui/coaching-sessions/coaching-notes.tsx`

The `CoachingNotes` component consumes the cached editor state via `useEditorCache()`:

```typescript
const { yDoc, extensions, isReady, isLoading, error } = useEditorCache();
```

- Removed local Y.Doc creation logic (~95 lines)
- Uses shared collaborative instances
- Maintains progress indicator for initial loading

## Modular Architecture

The EditorCacheProvider has been refactored into a modular architecture with clear separation of concerns.

### Type-Safe Action Handling

The provider lifecycle uses a discriminated union pattern for type-safe action handling:

```typescript
const ActionKind = {
  Initialize: "initialize",
  Skip: "skip",
  Error: "error",
  Cleanup: "cleanup",
} as const;

interface InitializeAction {
  readonly kind: typeof ActionKind.Initialize;
}

interface SkipAction {
  readonly kind: typeof ActionKind.Skip;
  readonly reason: string;
}

interface ErrorAction {
  readonly kind: typeof ActionKind.Error;
  readonly error: Error;
}

interface CleanupAction {
  readonly kind: typeof ActionKind.Cleanup;
}

type ProviderAction = InitializeAction | SkipAction | ErrorAction | CleanupAction;
```

This enables exhaustive pattern matching in the lifecycle effect with compile-time type safety.

### Helper Functions

**`createInitialCacheState()`**: Creates the initial cache state with default values for consistent state initialization.

**`determineProviderAction()`**: Determines the appropriate action based on provider lifecycle state. Handles:
- Token loading states (skip while loading)
- Session changes (cleanup stale provider, then initialize)
- Valid token/session combinations (initialize if needed)
- Token errors with transient error protection

### Reusable Hooks

#### useLogoutCleanup

**Location**: `src/lib/hooks/use-logout-cleanup.ts`

Registers a cleanup function to be called during logout via the `logoutCleanupRegistry`:
- Automatically unregisters on component unmount
- Uses ref pattern to avoid re-registration on every render
- Ensures cleanup function always has access to latest values

```typescript
useLogoutCleanup(
  useCallback(() => {
    cleanupProvider(providerRef);
    resetPresenceState();
  }, [])
);
```

Also used by:
- `use-sidebar-state.ts` - clears navigation drawer state on logout

### Data Flow

```
JWT Token (SWR) ──┐
User Session ─────┼──▶ EditorCacheProvider ──▶ Cache State
User Role ────────┘           │
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            TiptapCollabProvider   Presence State
                    │
                    ▼
              Y.Doc + Extensions
```

### Error Handling

The provider lifecycle handles errors at multiple levels:
1. **Token timeout**: Shows error state with "Try Again" button
2. **Provider initialization failure**: Falls back to offline editing mode
3. **Transient errors**: Ignored if provider is already connected (prevents SWR revalidation disruption)

## Testing

**Location**: `__tests__/components/ui/coaching-sessions/editor-cache-context.test.tsx`

Comprehensive test suite covering:
- Y.Doc reuse across component remounts
- Provider cleanup on session changes  
- JWT error handling and fallback behavior
- Cache reset functionality
- Collaboration sync callbacks

## Performance Impact

- **Before**: 1-2 second delay on tab switches due to editor recreation
- **After**: Instantaneous tab switching with preserved state
- **Memory**: Single collaborative instance per session vs. recreation per tab
- **User Experience**: Seamless navigation between Notes, Agreements, and Actions