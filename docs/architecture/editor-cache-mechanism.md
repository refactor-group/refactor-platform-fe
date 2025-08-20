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