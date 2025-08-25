# Product Requirements Document: User Presence in Coaching Sessions

## 1. Executive Summary

### 1.1 Purpose
Implement real-time user presence indicators in coaching sessions to show when coach and coachee are actively connected to the session, enhancing awareness and engagement during collaborative coaching activities.

### 1.2 Scope
This feature will display presence status indicators (green/black dots) next to participant names in the CoachingSessionTitle component, leveraging the existing TipTap awareness infrastructure.

### 1.3 Goals
- Provide immediate visual feedback on participant availability
- Enhance session engagement by showing real-time connection status
- Improve coaching effectiveness through presence awareness
- Maintain simplicity and performance in the UI

## 2. Feature Overview

### 2.1 User Story
**As a** coach or coachee  
**I want to** see when my coaching partner is present in the session  
**So that** I know when they are available and engaged in our collaborative work

### 2.2 Key Features
- Real-time presence indicators (green = connected, black = disconnected)
- Instant status updates without animations or delays
- Simple visual design integrated into existing title component
- Leverages TipTap awareness for reliable presence tracking

## 3. Technical Requirements

### 3.1 Architecture Overview

#### 3.1.1 Presence Detection
- **Method**: Session connection-based detection
- **Trigger**: User has coaching session page open in browser
- **Updates**: Instant status changes on connect/disconnect
- **Technology**: TipTap awareness API via existing collaboration provider

#### 3.1.2 Data Flow
```
User Opens Session → TipTap Provider Connects → Awareness State Updates → 
Presence Indicator Renders → Other Users See Update (via WebSocket)
```

### 3.2 Implementation Details

#### 3.2.1 Awareness State Structure
```typescript
interface UserPresence {
  userId: string;
  name: string;
  role: 'coach' | 'coachee';
  isConnected: boolean;
  lastSeen?: Date;
  color: string; // Existing color from current implementation
}
```

#### 3.2.2 Component Integration
- **Location**: `src/components/ui/coaching-sessions/coaching-session-title.tsx`
- **Dependencies**: 
  - Existing `EditorCacheProvider` for TipTap awareness
  - Current coaching relationship data for user roles
  - WebSocket connection via TiptapCollabProvider

#### 3.2.3 Awareness Updates
```typescript
// Set presence on mount/connect
provider.setAwarenessField('presence', {
  userId: currentUser.id,
  name: currentUser.displayName,
  role: determineUserRole(), // 'coach' or 'coachee'
  isConnected: true,
  lastSeen: new Date()
});

// Listen for presence changes
provider.on('awarenessChange', ({ states }) => {
  updatePresenceIndicators(states);
});
```

### 3.3 Visual Design

#### 3.3.1 Presence Indicators
- **Active (Green)**: `🟢` or CSS class `bg-green-500` (8px diameter circle)
- **Inactive (Black)**: `⚫` or CSS class `bg-gray-900` (8px diameter circle)
- **Position**: Directly before the user's name in the title
- **Spacing**: 4px margin between dot and name

#### 3.3.2 Title Format Examples
- Single user connected: `🟢 John Smith - Jane Doe`
- Both users connected: `🟢 John Smith - 🟢 Jane Doe`
- Coach offline: `⚫ John Smith - 🟢 Jane Doe`

### 3.4 Performance Considerations

#### 3.4.1 Optimization Strategies
- Reuse existing WebSocket connection from TipTap collaboration
- Debounce rapid connection state changes (optional, if needed)
- Minimal DOM updates using React memo and selective re-rendering
- Leverage existing `EditorCacheProvider` to avoid duplicate connections

#### 3.4.2 Scalability
- Current: Support 2 users (coach and coachee)
- Future: Architecture supports multiple participants if needed
- WebSocket message size: ~100 bytes per presence update

## 4. User Experience

### 4.1 User Flows

#### 4.1.1 Coach Enters Session
1. Coach opens coaching session page
2. Coach's presence indicator turns green immediately
3. If coachee is already present, coach sees green dot next to coachee's name
4. If coachee is not present, coach sees black dot next to coachee's name

#### 4.1.2 Connection Loss
1. User loses internet connection or closes tab
2. Presence indicator turns black for other participants
3. No delay or fade animation - instant feedback
4. Reconnection immediately updates indicator to green

### 4.2 Edge Cases
- **Page Refresh**: Brief disconnect/reconnect should be handled gracefully
- **Multiple Tabs**: Last active tab maintains presence
- **Network Issues**: Fallback to disconnected state on WebSocket failure
- **Session Permissions**: Only show presence for authorized participants

## 5. Implementation Plan

### 5.1 Phase 1: Core Presence (MVP)
**Timeline**

**Tasks**:
1. Extend EditorCacheProvider with presence tracking
2. Add presence state management to coaching session context
3. Update CoachingSessionTitle component with presence indicators
4. Implement awareness event listeners
5. Add basic styling for presence dots
6. Unit tests for presence logic

**Deliverables**:
- Presence indicators in session title
- Real-time updates via TipTap awareness
- Basic green/black dot visualization

## 6. Testing Strategy

### 6.1 Unit Tests
- Presence state management logic
- Awareness field updates
- Role determination from coaching relationship
- Component rendering with presence props

### 6.2 Integration Tests
- WebSocket connection handling
- Awareness synchronization between users
- Presence persistence across tab switches
- Error handling for connection failures

### 6.4 Manual Testing Checklist
- [ ] Coach sees coachee presence correctly
- [ ] Coachee sees coach presence correctly
- [ ] Instant updates on connect/disconnect
- [ ] Correct role identification
- [ ] Proper cleanup on session exit
- [ ] Performance with rapid status changes

## 8. Security & Privacy

### 8.1 Data Handling
- Presence data is ephemeral (not persisted to database)
- Only visible to authorized session participants
- Cleared immediately on session exit
- No PII beyond existing user display names

### 8.2 Access Control
- Leverage existing session authorization
- Presence only visible to coach and coachee
- No presence data exposed to unauthorized users

## 9. Dependencies

### 9.1 Technical Dependencies
- TipTap Collaboration Provider (existing)
- Yjs awareness API (existing)
- WebSocket infrastructure (existing)
- React 19 (existing)
- Next.js 15 (existing)

### 9.2 Data Dependencies
- User session data (existing)
- Coaching relationship data (existing)
- JWT tokens for collaboration (existing)

## 10. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| WebSocket connection instability | High | Medium | Implement reconnection logic and offline indicators |
| Performance degradation | Medium | Low | Optimize rendering and use existing connections |
| Browser compatibility issues | Low | Low | Test across major browsers, use standard APIs |
| Presence state out of sync | Medium | Low | Implement periodic sync and cleanup mechanisms |


## 12. Appendix

### 12.1 References
- [TipTap Awareness Documentation](https://tiptap.dev/docs/collaboration/core-concepts/awareness)
- Existing EditorCacheProvider implementation
- Current WebSocket infrastructure documentation

### 12.2 Glossary
- **Awareness**: TipTap's real-time state sharing mechanism
- **Presence**: User's connection status in a session
- **Provider**: TipTap collaboration WebSocket connection handler
- **Y.Doc**: Yjs document instance for collaborative editing
