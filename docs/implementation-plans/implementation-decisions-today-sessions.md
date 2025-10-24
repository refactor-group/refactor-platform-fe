# Implementation Decisions: Today's Sessions Feature

**Date**: 2025-10-23
**Feature**: GitHub Issue #160 - Today's Sessions Carousel Component

## Decisions Made

### 1. Multi-Organization Data Fetching
**Decision**: Create custom hook `useTodaysSessions()` that handles parallel data fetching across organizations

**Rationale**:
- Follows React hooks rules (can call hooks in stable loops)
- Encapsulates complexity of multi-level data fetching
- Provides granular error reporting per data source
- Exposes unified `refresh()` function for SWR revalidation

**Implementation**: See `src/lib/hooks/use-todays-sessions.ts` in design doc

---

### 2. Loading States
**Decision**: Show loading skeleton while ANY data is loading

**Pattern**:
```typescript
if (isLoading) {
  return <LoadingSkeleton />;
}
```

**Rationale**:
- Prevents flickering as different data sources load
- Provides clear feedback to user
- Follows existing codebase patterns in `coaching-session-list.tsx`

---

### 3. Error Handling
**Decision**: Show granular errors for each failed data source

**Pattern**:
```typescript
const errors = {
  organizations: isErrorOrgs,
  relationshipsByOrg: [...failed orgs with names...],
  sessionsByRelationship: [...failed relationships with context...]
};

// Display in UI:
"Unable to load sessions from Refactor Group. Please try again."
```

**Rationale**:
- User knows exactly what failed
- Can still see sessions from orgs that succeeded
- Actionable error messages
- Better debugging information

---

### 4. Real-Time Updates
**Decision**: Poll every 5 minutes (300000ms) instead of 60 seconds

**Implementation**:
```typescript
setInterval(() => {
  setCurrentTime(DateTime.now());
  // Recalculate urgency based on new time
}, 300000); // 5 minutes
```

**Rationale**:
- Urgency changes happen at coarser intervals (imminent, soon, later)
- Reduces unnecessary re-renders
- Sufficient for user needs
- Server-side push events will replace this later
- Battery-friendly for mobile devices

---

### 5. Testing Frameworks
**Confirmed Available**:
- **Vitest**: Unit and integration testing
- **React Testing Library**: Component testing
- **Playwright**: E2E and browser testing

**TDD Approach**: Red → Green → Refactor
- Write tests first
- Make them pass
- Refactor for story-driven readability

---

### 6. Auth Store Access Pattern
**Pattern Confirmed**:
```typescript
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { AuthStore } from "@/lib/stores/auth-store";

const { userSession } = useAuthStore((state: AuthStore) => state);
const userId = userSession?.id;
const firstName = userSession?.first_name;
const timezone = userSession?.timezone;
```

**Found in**: `src/components/ui/members/member-card.tsx`

---

### 7. Goal/Agenda Data
**Decision**: Fetch goal data separately for each session using `useOverarchingGoalBySession()`

**Implementation**:
```typescript
const { overarchingGoal, isLoading } = useOverarchingGoalBySession(sessionId);
const goalTitle = overarchingGoal?.title || "Coaching Session";
```

**Rationale**:
- Existing hook provides first/primary goal
- Falls back to "Coaching Session" if no goal exists
- Tracks loading state per session for skeleton display

---

### 8. Organization Scope
**Decision**: Show sessions from ALL organizations, regardless of current organization selection

**Rationale**:
- "Today's Sessions" is a global view across all coaching relationships
- User needs to see every session they have today
- Current organization is for relationship-specific views

---

### 9. Data Revalidation Strategy
**Decision**: Use SWR `refresh()` mutator instead of `window.location.reload()`

**Implementation**:
```typescript
// Midnight reset
setTimeout(() => {
  refresh(); // Triggers SWR revalidation
}, msUntilMidnight);

// Also refresh when underlying data changes via mutations
// SWR handles cache invalidation automatically
```

**Rationale**:
- Preserves React state and carousel position
- Faster than full page reload
- Works with SWR cache
- Integrates with existing patterns
- Dynamic updates when data changes

---

### 10. Embla Carousel
**Status**: Unknown behavior with dynamic content updates

**Mitigation Strategy**:
- Implement as designed
- Test thoroughly with urgency changes
- Monitor for issues during QA
- Have fallback plan (horizontal scroll with snap points)

**Watch For**:
- Carousel position jumping when content updates
- Swipe gesture conflicts with content changes
- Performance with frequent re-renders

---

## Session Filtering Strategy

**Keep ALL sessions for entire day until midnight reset**

Previous plan had 2-hour cutoff for past sessions - **REMOVED**

**New Behavior**:
```typescript
// Show all sessions scheduled for today
const todaysSessions = sessions.filter(isSessionToday);

// No time-based removal until midnight
// Past sessions show with "View Session" button and muted styling
```

**User Flow**:
- 9 AM: 3 sessions shown
- 2 PM: First session ended, still visible with "View Session"
- 6 PM: All sessions ended, all still visible with muted styling
- 11:59 PM: Still showing all 3 sessions
- 12:00 AM: Midnight reset triggers, new day's sessions loaded

---

## Implementation Order

Following TDD approach:

### Phase 0: Setup
1. Create test utilities and mock data factories
2. Set up test file structure

### Phase 1: Utility Functions
1. Write tests for `session-utils.ts`
2. Implement utility functions
3. Refactor for story-driven readability

### Phase 2: Custom Hook
1. Write tests for `use-todays-sessions.ts`
2. Implement custom hook
3. Verify multi-organization data fetching

### Phase 3: Session Card
1. Write tests for `TodaySessionCard`
2. Implement component
3. Test goal loading states

### Phase 4: Container Component
1. Write tests for `TodaysSessions`
2. Implement with custom hook
3. Test carousel behavior
4. Test error states
5. Test real-time updates

### Phase 5: Integration Testing
1. E2E tests with Playwright
2. Cross-browser testing
3. Mobile responsive testing
4. Performance testing

---

## Success Criteria

### Functional
- ✅ Shows sessions from all organizations
- ✅ Filters to today only (user timezone)
- ✅ Sorts chronologically
- ✅ Displays goal titles
- ✅ Updates urgency every 5 minutes
- ✅ Resets at midnight
- ✅ Granular error handling
- ✅ Loading skeletons

### Quality
- ✅ >90% test coverage
- ✅ All tests pass (Red → Green → Refactor)
- ✅ Story-driven code (human-readable)
- ✅ Follows existing patterns
- ✅ No React hooks violations

### Performance
- ✅ Loads in <2 seconds
- ✅ Smooth carousel transitions
- ✅ No excessive re-renders
- ✅ Efficient polling (5min intervals)

### UX
- ✅ Responsive design (mobile/tablet/desktop)
- ✅ Accessible (WCAG AA)
- ✅ Clear error messages
- ✅ Intuitive carousel navigation
- ✅ Share button in header

---

## Open Questions / Future Enhancements

1. **Embla Carousel Behavior**: Monitor for issues with dynamic updates
2. **Server-Side Push**: Replace polling when backend supports it
3. **Goal Data**: Consider caching strategy if many sessions
4. **Notification System**: Browser notifications 15min before session
5. **Timezone Changes**: Handle when user changes timezone setting

---

## References

- Design Document: `docs/design-today-sessions-component-160.md`
- GitHub Issue: #160
- Codebase Patterns: Documented in design doc section "Detailed Implementation Plan Using Existing Utilities"
