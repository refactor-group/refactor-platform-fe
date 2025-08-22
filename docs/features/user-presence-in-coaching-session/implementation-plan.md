# User Presence Implementation Plan

## Executive Summary

This document provides a systematic implementation workflow for adding real-time user presence indicators to coaching sessions. The implementation leverages existing TipTap awareness infrastructure, follows established codebase patterns, and uses modern React 19 and Next.js 15 best practices.

## Architecture Overview

### System Design
```
┌─────────────────────────────────────────────────────────┐
│                    Coaching Session Page                 │
├─────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────┐  │
│  │         CoachingSessionTitle (Enhanced)           │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │ 🟢 Coach Name - 🟢 Coachee Name             │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                           ↑                              │
│                    Presence Data                         │
│                           ↑                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │      EditorCacheProvider (Enhanced)               │  │
│  │  - Existing: Y.Doc, TiptapCollabProvider         │  │
│  │  - New: Presence state management                 │  │
│  │  - New: Awareness event listeners                 │  │
│  └───────────────────────────────────────────────────┘  │
│                           ↑                              │
│                    WebSocket (existing)                  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow
1. User opens coaching session → Provider connects
2. Provider sets awareness field with presence data
3. Awareness changes propagate via WebSocket
4. React context updates with presence states
5. UI components re-render with presence indicators

## Phase 1: Core Infrastructure Enhancement

### Step 1.1: Modern Type Definitions with Discriminated Unions
**File**: `/src/types/presence.ts` (new)

```typescript
// Modern TypeScript 5.7+ discriminated union approach (zero runtime overhead)
interface BasePresence {
  userId: string;
  name: string;
  role: 'coach' | 'coachee';
  color: string;
  lastSeen: Date;
}

interface ConnectedPresence extends BasePresence {
  status: 'connected';
  isConnected: true;
}

interface DisconnectedPresence extends BasePresence {
  status: 'disconnected';
  isConnected: false;
}

export type UserPresence = ConnectedPresence | DisconnectedPresence;

export interface PresenceState {
  users: Map<string, UserPresence>;
  currentUser: UserPresence | null;
  isLoading: boolean;
}

// Factory functions (idiomatic for controlled data creation)
export const createConnectedPresence = (
  base: Omit<BasePresence, 'lastSeen'>
): ConnectedPresence => ({
  ...base,
  status: 'connected',
  isConnected: true,
  lastSeen: new Date()
});

export const createDisconnectedPresence = (
  presence: ConnectedPresence
): DisconnectedPresence => ({
  ...presence,
  status: 'disconnected',
  isConnected: false,
  lastSeen: new Date()
});

// Simple utility for awareness data (no runtime validation needed)
export const toUserPresence = (awarenessData: any): UserPresence => {
  return awarenessData.isConnected
    ? { ...awarenessData, status: 'connected' as const }
    : { ...awarenessData, status: 'disconnected' as const };
};
```

### Step 1.2: Enhance EditorCacheProvider
**File**: `/src/components/ui/coaching-sessions/editor-cache-context.tsx`

**Modifications**:
1. Add presence state to context interface
2. Implement awareness event listeners
3. Add presence field management
4. Handle connection lifecycle

```typescript
// Add to existing imports
import { 
  UserPresence, 
  PresenceState, 
  createConnectedPresence,
  createDisconnectedPresence,
  toUserPresence 
} from '@/types/presence';
import { useCurrentCoachingRelationship } from '@/lib/hooks/use-current-coaching-relationship';

// Extend existing interface
interface EditorCacheState {
  // ... existing fields
  presenceState: PresenceState; // NEW
}

// In component implementation:
const [presenceState, setPresenceState] = useState<PresenceState>({
  users: new Map(),
  currentUser: null,
  isLoading: false,
});

// Add role determination
const determineUserRole = useCallback((): 'coach' | 'coachee' => {
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();
  const userId = userSession?.id;
  
  if (!currentCoachingRelationship || !userId) return 'coachee';
  
  return currentCoachingRelationship.coach_id === userId ? 'coach' : 'coachee';
}, [userSession, currentCoachingRelationship]);

// Enhanced provider initialization
const initializeProvider = useCallback(async () => {
  // ... existing provider setup
  
  // Create presence using factory function (idiomatic approach)
  const userPresence = createConnectedPresence({
    userId: userSession.id,
    name: userSession.display_name,
    role: determineUserRole(),
    color: "#ffcc00"
  });
  
  provider.setAwarenessField("presence", userPresence);
  
  // Listen for awareness changes (no runtime validation needed for trusted data)
  provider.on('awarenessChange', ({ states }) => {
    const updatedUsers = new Map<string, UserPresence>();
    
    states.forEach((state, clientId) => {
      if (state.presence) {
        // Direct transformation using discriminated union utility
        const presence = toUserPresence(state.presence);
        updatedUsers.set(presence.userId, presence);
      }
    });
    
    setPresenceState(prev => ({
      ...prev,
      users: updatedUsers,
      currentUser: userPresence
    }));
  });
  
  // Handle connection events with factory functions
  provider.on('connect', () => {
    const connectedPresence = createConnectedPresence({
      userId: userSession.id,
      name: userSession.display_name,
      role: determineUserRole(),
      color: "#ffcc00"
    });
    provider.setAwarenessField("presence", connectedPresence);
  });
  
  // Cleanup on disconnect
  const handleBeforeUnload = () => {
    const disconnectedPresence = createDisconnectedPresence(userPresence);
    provider.setAwarenessField("presence", disconnectedPresence);
  };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [jwt, sessionId, userSession, determineUserRole]);
```

## Phase 2: UI Component Enhancement

### Step 2.1: Create Presence Indicator Component
**File**: `/src/components/ui/presence-indicator.tsx` (new)

```typescript
import React from 'react';
import { cn } from '@/components/lib/utils';
import { UserPresence } from '@/types/presence';

interface PresenceIndicatorProps {
  presence: UserPresence | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = React.memo(({
  presence,
  size = 'sm',
  className
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  
  // Automatic type narrowing with discriminated unions (no manual checks needed)
  const isConnected = presence?.status === 'connected';
  
  return (
    <span
      className={cn(
        'inline-block rounded-full transition-colors duration-200',
        sizeClasses[size],
        isConnected ? 'bg-green-500' : 'bg-gray-900 dark:bg-gray-700',
        className
      )}
      aria-label={isConnected ? 'Online' : 'Offline'}
      role="status"
    />
  );
});

PresenceIndicator.displayName = 'PresenceIndicator';
```

### Step 2.2: Enhance CoachingSessionTitle
**File**: `/src/components/ui/coaching-sessions/coaching-session-title.tsx`

```typescript
// Add imports
import { useEditorCache } from '../editor-cache-context';
import { PresenceIndicator } from '@/components/ui/presence-indicator';
import { UserPresence } from '@/types/presence';

// Inside component
const { presenceState } = useEditorCache();

// Helper to get presence by role (with automatic type narrowing)
const getPresenceByRole = (role: 'coach' | 'coachee'): UserPresence | undefined => {
  return Array.from(presenceState.users.values()).find(u => u.role === role);
};

// Enhanced title rendering with discriminated union benefits
const renderTitleWithPresence = useMemo(() => {
  if (!sessionTitle || !currentCoachingRelationship) return displayTitle;
  
  const coachPresence = getPresenceByRole('coach');
  const coacheePresence = getPresenceByRole('coachee');
  
  // Parse the existing title format
  const [coachName, coacheeName] = displayTitle.split(' - ');
  
  return (
    <span className="flex items-center gap-1">
      <PresenceIndicator presence={coachPresence} />
      <span>{coachName}</span>
      <span className="mx-2">-</span>
      <PresenceIndicator presence={coacheePresence} />
      <span>{coacheeName}</span>
    </span>
  );
}, [displayTitle, sessionTitle, currentCoachingRelationship, presenceState]);

// Update return statement
return (
  <div>
    <h4 className="font-semibold break-words w-full md:text-clip">
      {renderTitleWithPresence}
    </h4>
    {/* ... existing past session message */}
  </div>
);
```

## Phase 3: Performance Optimization

### Step 3.1: Implement Debounced Updates
**File**: `/src/lib/hooks/use-debounced-presence.ts` (new)

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { UserPresence } from '@/types/presence';

export const useDebouncedPresence = (
  updateFn: (presence: Map<string, UserPresence>) => void,
  delay: number = 100
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdates = useRef<Map<string, UserPresence>>(new Map());
  
  const debouncedUpdate = useCallback((updates: Map<string, UserPresence>) => {
    // Merge with pending updates
    updates.forEach((value, key) => {
      pendingUpdates.current.set(key, value);
    });
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      updateFn(new Map(pendingUpdates.current));
      pendingUpdates.current.clear();
    }, delay);
  }, [updateFn, delay]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedUpdate;
};
```

## Phase 4: Error Handling & Edge Cases

### Step 4.1: Connection Recovery
**File**: `/src/components/ui/coaching-sessions/editor-cache-context.tsx`

```typescript
// Add reconnection logic
const handleReconnection = useCallback(() => {
  let reconnectAttempts = 0;
  const maxAttempts = 5;
  const baseDelay = 1000;
  
  const attemptReconnect = () => {
    if (reconnectAttempts >= maxAttempts) {
      console.error('Max reconnection attempts reached');
      setPresenceState(prev => ({
        ...prev,
        users: new Map(),
        isLoading: false
      }));
      return;
    }
    
    reconnectAttempts++;
    const delay = baseDelay * Math.pow(2, reconnectAttempts - 1);
    
    setTimeout(() => {
      if (providerRef.current?.shouldConnect) {
        providerRef.current.connect();
      }
    }, delay);
  };
  
  provider.on('disconnect', () => {
    // Mark all users as disconnected using factory function
    setPresenceState(prev => ({
      ...prev,
      users: new Map(
        Array.from(prev.users.entries()).map(([id, user]) => [
          id,
          user.status === 'connected' 
            ? createDisconnectedPresence(user)
            : user // Already disconnected
        ])
      )
    }));
    
    attemptReconnect();
  });
}, []);
```

## Phase 5: Testing Implementation

### Step 5.1: Unit Tests
**File**: `/__tests__/components/ui/presence-indicator.test.tsx` (new)

```typescript
import { render, screen } from '@testing-library/react';
import { PresenceIndicator } from '@/components/ui/presence-indicator';
import { createConnectedPresence, createDisconnectedPresence } from '@/types/presence';

describe('PresenceIndicator', () => {
  const mockConnectedPresence = createConnectedPresence({
    userId: 'user1',
    name: 'Test User',
    role: 'coach',
    color: '#ffcc00'
  });

  const mockDisconnectedPresence = createDisconnectedPresence(mockConnectedPresence);

  it('renders green when user is connected', () => {
    render(<PresenceIndicator presence={mockConnectedPresence} />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-green-500');
    expect(indicator).toHaveAttribute('aria-label', 'Online');
  });
  
  it('renders gray when user is disconnected', () => {
    render(<PresenceIndicator presence={mockDisconnectedPresence} />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-gray-900');
    expect(indicator).toHaveAttribute('aria-label', 'Offline');
  });

  it('renders gray when presence is undefined', () => {
    render(<PresenceIndicator presence={undefined} />);
    const indicator = screen.getByRole('status');
    expect(indicator).toHaveClass('bg-gray-900');
    expect(indicator).toHaveAttribute('aria-label', 'Offline');
  });
});
```

### Step 5.2: Integration Tests
**File**: `/__tests__/features/user-presence.test.tsx` (new)

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { EditorCacheProvider } from '@/components/ui/coaching-sessions/editor-cache-context';
import { createConnectedPresence } from '@/types/presence';

describe('User Presence Integration', () => {
  it('updates presence on awareness changes', async () => {
    // Mock provider and awareness events
    const mockProvider = {
      setAwarenessField: vi.fn(),
      on: vi.fn(),
      disconnect: vi.fn()
    };
    
    // Test awareness propagation with discriminated union
    await waitFor(() => {
      expect(mockProvider.setAwarenessField).toHaveBeenCalledWith(
        'presence',
        expect.objectContaining({
          status: 'connected',
          isConnected: true
        })
      );
    });
  });

  it('creates presence using factory functions', () => {
    const presence = createConnectedPresence({
      userId: 'test-user',
      name: 'Test User',
      role: 'coach',
      color: '#ffcc00'
    });

    expect(presence.status).toBe('connected');
    expect(presence.isConnected).toBe(true);
    expect(presence.lastSeen).toBeInstanceOf(Date);
  });
});
```

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| WebSocket instability | Exponential backoff reconnection |
| State synchronization issues | Debounced updates with discriminated unions |
| Memory leaks | Proper cleanup in useEffect |
| Browser compatibility | Use standard WebSocket APIs |
| Type runtime errors | Eliminated via discriminated unions (compile-time safety) |
