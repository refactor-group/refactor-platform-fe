# Design: Today's Sessions Component (Issue #160)

## Overview
Design specification for a new dashboard component that displays all coaching sessions scheduled for the current day across all organizations and coaching relationships for the logged-in user.

## Requirements

### Functional Requirements
1. **Personalized Welcome**: Display "Welcome {user.first_name}!" as the title
2. **Clear Context**: Show "Today's Sessions" as subheader
3. **Cross-Organization Sessions**: Aggregate sessions from all organizations the user belongs to
4. **Timezone Awareness**: Filter sessions based on user's timezone (stored in `userSession.timezone`)
5. **Session Actions**: Each session row must include:
   - Session details (overarching goal, date/time)
   - Who the user is going to meet with for each session
   - Clearly states their role (Coach / Coachee) from each coaching relationship
   - "Join Session" / "View Session" button (based on session timing)
   - Navigation to coaching session page
6. **Placement**: Located above the "Add New" section on the dashboard

### Non-Functional Requirements
- **Performance**: Minimize API calls, leverage existing hooks
- **Responsive**: Work on mobile, tablet, and desktop
- **Accessibility**: Proper ARIA labels, keyboard navigation
- **Consistency**: Match existing UI patterns and component library

## Current System Analysis

### Existing Components & Patterns
- **Dashboard Container** (`dashboard-container.tsx`): Main dashboard layout component
- **Coaching Session List** (`coaching-session-list.tsx`): Displays sessions filtered by relationship
- **Coaching Session Card** (`coaching-session.tsx`): Individual session display with actions
- **Add Entities** (`add-entities.tsx`): "Add New" section with create buttons

### Data Models
```typescript
// From src/types/coaching-session.ts
interface CoachingSession {
  id: Id;
  coaching_relationship_id: Id;
  date: string; // ISO date string
  created_at: DateTime;
  updated_at: DateTime;
}

// From src/types/coaching_relationship.ts
interface CoachingRelationshipWithUserNames {
  id: Id;
  coach_id: Id;
  coachee_id: Id;
  organization_id: Id;
  coach_first_name: string;
  coach_last_name: string;
  coachee_first_name: string;
  coachee_last_name: string;
  created_at: DateTime;
  updated_at: DateTime;
}

// From src/types/user.ts
interface User {
  id: Id;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  timezone: string;
  role: Role;
  roles: UserRole[];
}

// From src/lib/stores/auth-store.ts
interface UserSession {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string;
  timezone: string;
  expires_at: DateTime;
}
```

### Existing API Hooks
- `useCoachingSessionList(relationshipId, fromDate, toDate)`: Fetches sessions for a single relationship
- `useCoachingRelationshipList(organizationId)`: Fetches relationships for an organization
- `useAuthStore()`: Provides `userSession` with user info including `first_name` and `timezone`

### Existing Utility Functions
```typescript
// From src/types/coaching-session.ts
isSessionToday(session: CoachingSession): boolean
isPastSession(session: CoachingSession): boolean
isFutureSession(session: CoachingSession): boolean

// From src/lib/timezone-utils.ts
formatDateInUserTimezoneWithTZ(date: string, timezone: string): string
getBrowserTimezone(): string
```

## Design Solution

### Implementation Philosophy

**Human-Readable Code**: The implementation uses simple, single-purpose functions that read like a story. Each function does one thing well and has a clear, descriptive name.

**Maximize Reuse**: Leverage all existing utilities, patterns, and conventions from the codebase to maintain consistency and reduce bugs.

**Type Safety First**: Use existing type definitions and utility functions that already handle edge cases.

### Component Architecture

```
DashboardContainer
├── TodaysSessions (NEW)
│   ├── Carousel wrapper
│   │   ├── Welcome header
│   │   ├── CarouselContent
│   │   │   └── TodaySessionCard (multiple)
│   │   │       ├── Status indicator (urgency-based)
│   │   │       ├── Session details
│   │   │       ├── Join/View button
│   │   │       ├── Reschedule button
│   │   │       └── Share button
│   │   └── Navigation controls (arrows + dots)
│   └── Empty state (when no sessions)
├── AddEntities
└── CoachingSessionList
```

### New Component: `TodaysSessions`

**Location**: `src/components/ui/dashboard/todays-sessions.tsx`

**Props**:
```typescript
interface TodaysSessionsProps {
  className?: string;
}
```

**State Requirements**:
- User session data (from `useAuthStore`)
- All user organizations (requires new hook or API extension)
- All coaching relationships across organizations
- All sessions for today across all relationships

**Data Flow** (Leveraging Existing Utilities):
1. Get user context using `useAuthStore()` → `{ first_name, timezone, id }`
2. Fetch organizations using `useOrganizationList(userId)`
3. For each org, fetch relationships using `useCoachingRelationshipList(orgId)`
4. For each relationship, fetch sessions using `useCoachingSessionList(relationshipId, startOfDay, endOfDay)`
5. Filter to today using existing `isSessionToday(session)` utility
6. Sort chronologically using existing `filterAndSortCoachingSessions(sessions, SortOrder.Asc, true)`
7. Enrich with display data using new helper functions (see below)
8. Calculate urgency and update every 60 seconds

### New Component: `TodaySessionCard`

**Location**: `src/components/ui/dashboard/today-session-card.tsx`

**Props**:
```typescript
interface TodaySessionCardProps {
  coachingSession: CoachingSession;
  relationshipInfo: CoachingRelationshipWithUserNames;
}
```

**Display**:
- Overarching goal (if available)
- Relationship info: "Coach Name → Coachee Name" or display name based on user role
- Formatted date/time in user timezone
- Join/View button based on `isPastSession()`
- Navigation to `/coaching-sessions/{id}`

### API Requirements

**Challenge**: Current `useCoachingSessionList` requires a single `relationshipId`, but we need sessions across ALL relationships.

**Solution Options**:

#### Option A: Frontend Aggregation (Recommended for MVP)
```typescript
// Pseudo-code for TodaysSessions component
const TodaysSessions = () => {
  const { userSession } = useAuthStore();
  const { userId, timezone, first_name } = userSession;

  // Get all organizations for user
  const { organizations } = useUserOrganizations(userId);

  // For each org, get all relationships
  const relationshipsByOrg = organizations?.map(org =>
    useCoachingRelationshipList(org.id)
  ) || [];

  // Aggregate all relationships
  const allRelationships = relationshipsByOrg.flatMap(r => r.relationships || []);

  // For each relationship, fetch today's sessions
  const today = DateTime.now().setZone(timezone);
  const startOfDay = today.startOf('day');
  const endOfDay = today.endOf('day');

  const sessionsByRelationship = allRelationships.map(rel =>
    useCoachingSessionList(rel.id, startOfDay, endOfDay)
  );

  // Aggregate and filter to today only
  const todaysSessions = sessionsByRelationship
    .flatMap(s => s.coachingSessions || [])
    .filter(session => isSessionToday(session))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Render...
};
```

**Pros**:
- No backend changes required
- Reuses existing API hooks
- Can be implemented immediately

**Cons**:
- Multiple API calls (N organizations × M relationships)
- Not optimal for users with many organizations/relationships
- Complex loading state management

#### Option B: New Backend Endpoint (Recommended for Production)
Create a new endpoint: `GET /api/coaching_sessions/today` that:
- Accepts `user_id` and `timezone` parameters
- Returns all sessions for today across all user's organizations
- Includes relationship metadata in response
- Single optimized database query

**Pros**:
- Single API call
- Optimal performance
- Simple frontend logic
- Better for scaling

**Cons**:
- Requires backend development
- Longer implementation timeline

### Recommendation
**Phase 1 (MVP)**: Implement Option A (Frontend Aggregation) to deliver feature quickly.
**Phase 2 (Optimization)**: Add backend endpoint (Option B) for production performance.

---

## Detailed Implementation Plan Using Existing Utilities

### Philosophy: Simple, Readable Functions

Each function should tell a story. A developer should be able to read the code and understand what it does without complex mental gymnastics. Functions are small, single-purpose, and have descriptive names.

### New Custom Hook: `src/lib/hooks/use-todays-sessions.ts`

Create a custom hook to fetch and aggregate today's sessions across all organizations. This hook handles the complexity of multi-organization data fetching while following React hooks rules.

```typescript
import { useMemo } from "react";
import { DateTime } from "ts-luxon";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useOrganizationList } from "@/lib/api/organizations";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useOverarchingGoalBySession } from "@/lib/api/overarching-goals";
import { AuthStore } from "@/lib/stores/auth-store";
import {
  CoachingSession,
  isSessionToday,
  filterAndSortCoachingSessions,
} from "@/types/coaching-session";
import { SortOrder } from "@/types/sorting";
import { Id } from "@/types/general";

/**
 * Enriched session data for display
 */
export interface TodaySessionData {
  session: CoachingSession;
  relationshipId: Id;
  organizationId: Id;
  organizationName: string;
  coachName: string;
  coacheeName: string;
  goalTitle: string;
  isLoadingGoal: boolean;
}

/**
 * Hook to fetch all of today's coaching sessions across all user's organizations
 *
 * Story: "Get every coaching session I have today, no matter which organization it's in"
 */
export function useTodaysSessions() {
  // Get current user context
  const { userSession } = useAuthStore((state: AuthStore) => state);
  const userId = userSession?.id;
  const userTimezone = userSession?.timezone || "UTC";

  // Define today's date range in user's timezone
  const dateRange = useMemo(() => {
    const now = DateTime.now().setZone(userTimezone);
    return {
      startOfDay: now.startOf("day"),
      endOfDay: now.endOf("day"),
    };
  }, [userTimezone]);

  // Fetch all organizations user belongs to
  const {
    organizations,
    isLoading: isLoadingOrgs,
    isError: isErrorOrgs,
    refresh: refreshOrgs,
  } = useOrganizationList(userId || "");

  // Fetch relationships for each organization
  // Note: We can call hooks in a loop as long as the array length is stable
  const orgRelationships = (organizations || []).map((org) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { relationships, isLoading, isError, refresh } =
      useCoachingRelationshipList(org.id);
    return {
      organizationId: org.id,
      organizationName: org.name,
      relationships: relationships || [],
      isLoading,
      isError,
      refresh,
    };
  });

  // Flatten all relationships with their organization context
  const allRelationships = useMemo(() => {
    return orgRelationships.flatMap((orgRel) =>
      orgRel.relationships.map((rel) => ({
        ...rel,
        organizationId: orgRel.organizationId,
        organizationName: orgRel.organizationName,
      }))
    );
  }, [orgRelationships]);

  // Fetch sessions for each relationship
  const relationshipSessions = allRelationships.map((rel) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { coachingSessions, isLoading, isError, refresh } =
      useCoachingSessionList(
        rel.id,
        dateRange.startOfDay,
        dateRange.endOfDay
      );
    return {
      relationshipId: rel.id,
      organizationId: rel.organizationId,
      organizationName: rel.organizationName,
      coachName: `${rel.coach_first_name} ${rel.coach_last_name}`,
      coacheeName: `${rel.coachee_first_name} ${rel.coachee_last_name}`,
      sessions: coachingSessions || [],
      isLoading,
      isError,
      refresh,
    };
  });

  // Filter to only today's sessions and sort chronologically
  const todaysSessions = useMemo(() => {
    const allSessions = relationshipSessions.flatMap((relSessions) =>
      relSessions.sessions
        .filter(isSessionToday)
        .map((session) => ({
          session,
          relationshipId: relSessions.relationshipId,
          organizationId: relSessions.organizationId,
          organizationName: relSessions.organizationName,
          coachName: relSessions.coachName,
          coacheeName: relSessions.coacheeName,
        }))
    );

    // Sort by session date
    return allSessions.sort(
      (a, b) =>
        DateTime.fromISO(a.session.date).toMillis() -
        DateTime.fromISO(b.session.date).toMillis()
    );
  }, [relationshipSessions]);

  // Fetch goal for each session
  const enrichedSessions: TodaySessionData[] = todaysSessions.map(
    (sessionData) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { overarchingGoal, isLoading: isLoadingGoal } =
        useOverarchingGoalBySession(sessionData.session.id);

      return {
        ...sessionData,
        goalTitle: overarchingGoal?.title || "Coaching Session",
        isLoadingGoal,
      };
    }
  );

  // Determine overall loading state
  const isLoading =
    isLoadingOrgs ||
    orgRelationships.some((org) => org.isLoading) ||
    relationshipSessions.some((rel) => rel.isLoading);

  // Collect all errors for granular error reporting
  const errors = {
    organizations: isErrorOrgs,
    relationshipsByOrg: orgRelationships
      .filter((org) => org.isError)
      .map((org) => ({
        organizationId: org.organizationId,
        organizationName: org.organizationName,
      })),
    sessionsByRelationship: relationshipSessions
      .filter((rel) => rel.isError)
      .map((rel) => ({
        relationshipId: rel.relationshipId,
        organizationName: rel.organizationName,
      })),
  };

  const hasErrors =
    isErrorOrgs ||
    errors.relationshipsByOrg.length > 0 ||
    errors.sessionsByRelationship.length > 0;

  // Refresh all data sources
  const refresh = async () => {
    await refreshOrgs();
    await Promise.all(orgRelationships.map((org) => org.refresh()));
    await Promise.all(relationshipSessions.map((rel) => rel.refresh()));
  };

  return {
    sessions: enrichedSessions,
    isLoading,
    hasErrors,
    errors,
    refresh,
    userTimezone,
  };
}
```

### New Utility File: `src/lib/session-utils.ts`

Create a dedicated file for session-related helper functions that don't exist yet. These functions are simple and focused:

```typescript
import { DateTime } from "ts-luxon";
import { CoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Id } from "@/types/general";

/**
 * Urgency types for session display styling
 */
export type SessionUrgency = "imminent" | "soon" | "later" | "past";

/**
 * Calculate how urgent a session is based on time remaining
 *
 * Story: "Is this session happening right now, soon, later today, or already done?"
 */
export function calculateSessionUrgency(
  sessionDateTime: string,
  now: DateTime = DateTime.now()
): SessionUrgency {
  const sessionDate = DateTime.fromISO(sessionDateTime);
  const diffMinutes = sessionDate.diff(now, 'minutes').minutes;

  // Already happened
  if (diffMinutes < 0) {
    return "past";
  }

  // Starting very soon (< 1 hour)
  if (diffMinutes <= 60) {
    return "imminent";
  }

  // Coming up (< 3 hours)
  if (diffMinutes <= 180) {
    return "soon";
  }

  // Later today
  return "later";
}

/**
 * Create a human-friendly urgency message
 *
 * Story: "Tell the user when their session is in friendly language"
 */
export function getUrgencyMessage(
  sessionDateTime: string,
  now: DateTime = DateTime.now()
): string {
  const sessionDate = DateTime.fromISO(sessionDateTime);
  const diffMinutes = sessionDate.diff(now, 'minutes').minutes;

  if (diffMinutes < 0) {
    return "Session ended";
  }

  if (diffMinutes < 5) {
    return "Starting now!";
  }

  if (diffMinutes <= 60) {
    const mins = Math.round(diffMinutes);
    return `Next session in ${mins} ${mins === 1 ? 'minute' : 'minutes'}`;
  }

  if (diffMinutes <= 180) {
    return "Starting soon";
  }

  // Determine time of day
  const hour = sessionDate.hour;
  if (hour < 12) {
    return "Scheduled for this morning";
  } else if (hour < 17) {
    return "Scheduled for this afternoon";
  } else {
    return "Scheduled for this evening";
  }
}

/**
 * Get the name of who the user is meeting with
 *
 * Story: "If I'm the coach, show me the coachee's name. If I'm the coachee, show the coach's name."
 */
export function getParticipantName(
  relationship: CoachingRelationshipWithUserNames,
  currentUserId: Id
): string {
  const isCoach = relationship.coach_id === currentUserId;

  if (isCoach) {
    return `${relationship.coachee_first_name} ${relationship.coachee_last_name}`;
  } else {
    return `${relationship.coach_first_name} ${relationship.coach_last_name}`;
  }
}

/**
 * Determine what role the user has in this relationship
 *
 * Story: "Am I the coach or the coachee in this relationship?"
 */
export function getUserRole(
  relationship: CoachingRelationshipWithUserNames,
  currentUserId: Id
): "Coach" | "Coachee" {
  return relationship.coach_id === currentUserId ? "Coach" : "Coachee";
}

/**
 * Enrich a session with all the display information needed for the UI
 *
 * Story: "Take raw session data and add everything the UI needs to show it beautifully"
 */
export interface EnrichedSession {
  session: CoachingSession;
  relationship: CoachingRelationshipWithUserNames;
  participantName: string;
  userRole: "Coach" | "Coachee";
  urgency: SessionUrgency;
  urgencyMessage: string;
  organizationName: string;
  isPast: boolean;
}

export function enrichSessionForDisplay(
  session: CoachingSession,
  relationship: CoachingRelationshipWithUserNames,
  organizationName: string,
  currentUserId: Id
): EnrichedSession {
  return {
    session,
    relationship,
    participantName: getParticipantName(relationship, currentUserId),
    userRole: getUserRole(relationship, currentUserId),
    urgency: calculateSessionUrgency(session.date),
    urgencyMessage: getUrgencyMessage(session.date),
    organizationName,
    isPast: isPastSession(session), // Use existing utility
  };
}
```

### Component Implementation: `TodaysSessions`

**Story-Driven Structure**: Each section of the component tells part of the story.

```typescript
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { DateTime } from "ts-luxon";

// Types
import { CoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Organization } from "@/types/organization";
import { Id } from "@/types/general";
import { SortOrder } from "@/types/sorting";

// Existing utilities (REUSE EVERYTHING)
import {
  isSessionToday,
  isPastSession,
  filterAndSortCoachingSessions
} from "@/types/coaching-session";

// New utilities (simple, focused functions)
import {
  EnrichedSession,
  enrichSessionForDisplay,
  calculateSessionUrgency,
  getUrgencyMessage,
} from "@/lib/session-utils";

// API Hooks (existing patterns)
import { useOrganizationList } from "@/lib/api/organizations";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";

// Auth store
import { useAuthStore } from "@/lib/providers/auth-store-provider";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { TodaySessionCard } from "./today-session-card";
import { cn } from "@/components/lib/utils";

interface TodaysSessionsProps {
  className?: string;
}

export function TodaysSessions({ className }: TodaysSessionsProps) {
  // ============================================================================
  // CHAPTER 1: Get Current User Context
  // Story: "Who is logged in and what's their timezone?"
  // ============================================================================

  const authStore = useAuthStore();
  const userId = authStore.userSession?.id;
  const userTimezone = authStore.userSession?.timezone || "UTC";
  const userFirstName = authStore.userSession?.first_name || "there";

  // ============================================================================
  // CHAPTER 2: Fetch User's Organizations
  // Story: "What organizations does this user belong to?"
  // ============================================================================

  const {
    organizations,
    isLoading: isLoadingOrgs,
    isError: isErrorOrgs
  } = useOrganizationList(userId || "");

  // ============================================================================
  // CHAPTER 3: Fetch All Coaching Relationships Across Organizations
  // Story: "For each organization, who is this user coaching or being coached by?"
  // ============================================================================

  const allRelationships = useMemo(() => {
    if (!organizations) return [];

    // Flatten relationships from all organizations
    const relationships: CoachingRelationshipWithUserNames[] = [];

    organizations.forEach(org => {
      const { relationships: orgRelationships } = useCoachingRelationshipList(org.id);
      if (orgRelationships) {
        relationships.push(...orgRelationships);
      }
    });

    return relationships;
  }, [organizations]);

  // ============================================================================
  // CHAPTER 4: Fetch Today's Sessions For All Relationships
  // Story: "What sessions are scheduled today across all my coaching relationships?"
  // ============================================================================

  const todaysDateRange = useMemo(() => {
    const now = DateTime.now().setZone(userTimezone);
    return {
      startOfDay: now.startOf('day'),
      endOfDay: now.endOf('day'),
    };
  }, [userTimezone]);

  const allSessions = useMemo(() => {
    if (!allRelationships.length) return [];

    const sessions: CoachingSession[] = [];

    allRelationships.forEach(relationship => {
      const { coachingSessions } = useCoachingSessionList(
        relationship.id,
        todaysDateRange.startOfDay,
        todaysDateRange.endOfDay
      );

      if (coachingSessions) {
        sessions.push(...coachingSessions);
      }
    });

    return sessions;
  }, [allRelationships, todaysDateRange]);

  // ============================================================================
  // CHAPTER 5: Filter and Sort Today's Sessions
  // Story: "Show only sessions scheduled for today, sorted chronologically"
  // ============================================================================

  const todaysSessions = useMemo(() => {
    // Use existing utility to filter to today only
    const sessionsToday = allSessions.filter(isSessionToday);

    // Use existing utility to sort chronologically (ascending = earliest first)
    return filterAndSortCoachingSessions(sessionsToday, SortOrder.Asc, true);
  }, [allSessions]);

  // ============================================================================
  // CHAPTER 6: Enrich Sessions with Display Data
  // Story: "Add all the information needed to display each session beautifully"
  // ============================================================================

  const enrichedSessions = useMemo<EnrichedSession[]>(() => {
    return todaysSessions.map(session => {
      // Find the relationship for this session
      const relationship = allRelationships.find(
        r => r.id === session.coaching_relationship_id
      );

      if (!relationship) {
        // Should never happen, but handle gracefully
        return null;
      }

      // Find the organization for this relationship
      const organization = organizations?.find(
        org => org.id === relationship.organization_id
      );

      // Use simple helper function to enrich with all display data
      return enrichSessionForDisplay(
        session,
        relationship,
        organization?.name || "Unknown Organization",
        userId || ""
      );
    }).filter(Boolean) as EnrichedSession[];
  }, [todaysSessions, allRelationships, organizations, userId]);

  // ============================================================================
  // CHAPTER 7: Real-Time Updates
  // Story: "Keep urgency messages current as time passes"
  // ============================================================================

  const [currentTime, setCurrentTime] = useState(DateTime.now());

  useEffect(() => {
    // Update every 5 minutes to keep urgency messages current
    // This is sufficient since urgency changes happen at larger time intervals
    const interval = setInterval(() => {
      setCurrentTime(DateTime.now());
    }, 300000); // 5 minutes (300000 ms)

    return () => clearInterval(interval);
  }, []);

  // Recalculate urgency when time updates
  const sessionsWithCurrentUrgency = useMemo(() => {
    return enrichedSessions.map(enriched => ({
      ...enriched,
      urgency: calculateSessionUrgency(enriched.session.date, currentTime),
      urgencyMessage: getUrgencyMessage(enriched.session.date, currentTime),
      isPast: isPastSession(enriched.session),
    }));
  }, [enrichedSessions, currentTime]);

  // ============================================================================
  // CHAPTER 8: Midnight Reset
  // Story: "Refresh sessions at midnight to show the new day's schedule"
  // ============================================================================

  useEffect(() => {
    const now = DateTime.now();
    const tomorrow = now.plus({ days: 1 }).startOf('day');
    const msUntilMidnight = tomorrow.diff(now).milliseconds;

    const midnightTimer = setTimeout(() => {
      // Trigger SWR revalidation at midnight for fresh data
      refresh();
    }, msUntilMidnight);

    return () => clearTimeout(midnightTimer);
  }, [refresh]);

  // ============================================================================
  // CHAPTER 9: Carousel State Management
  // Story: "Track which session card the user is viewing"
  // ============================================================================

  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  // ============================================================================
  // CHAPTER 10: Handle Empty State
  // Story: "Show a friendly message when there are no sessions today"
  // ============================================================================

  if (sessionsWithCurrentUrgency.length === 0) {
    return (
      <Card className={cn("mb-8", className)}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome {userFirstName}!
          </CardTitle>
          <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">
              No coaching sessions scheduled for today. Enjoy your day!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // CHAPTER 11: Render Carousel with Sessions
  // Story: "Display sessions in a beautiful carousel that users can navigate"
  // ============================================================================

  return (
    <div className={cn("space-y-4", className)}>
      {/* Welcome Header */}
      <h3 className="text-xl sm:text-2xl font-semibold tracking-tight">
        Welcome {userFirstName}!
      </h3>
      <p className="text-sm text-muted-foreground">Today&apos;s Sessions</p>

      {/* Carousel */}
      <div className="max-w-2xl">
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: false,
          }}
        >
          <CarouselContent className="ml-0">
            {sessionsWithCurrentUrgency.map((enriched) => (
              <CarouselItem key={enriched.session.id} className="pl-0">
                <TodaySessionCard
                  session={enriched.session}
                  participantName={enriched.participantName}
                  userRole={enriched.userRole}
                  urgency={enriched.urgency}
                  urgencyMessage={enriched.urgencyMessage}
                  organizationName={enriched.organizationName}
                  isPast={enriched.isPast}
                  userTimezone={userTimezone}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Navigation Controls (only show if more than one session) */}
      {count > 1 && (
        <div className="max-w-2xl">
          <div className="flex items-center justify-center gap-4 mt-6">
            {/* Previous Button */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={current === 0}
              onClick={() => api?.scrollPrev()}
              aria-label="Previous session"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Dot Indicators */}
            <div className="flex gap-2">
              {Array.from({ length: count }).map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    index === current
                      ? "bg-primary w-8"
                      : "bg-muted-foreground/30 w-2"
                  )}
                  onClick={() => api?.scrollTo(index)}
                  aria-label={`Go to session ${index + 1}`}
                />
              ))}
            </div>

            {/* Next Button */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={current === count - 1}
              onClick={() => api?.scrollNext()}
              aria-label="Next session"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Accessibility: Screen reader announcement */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Session {current + 1} of {count}
      </div>
    </div>
  );
}
```

### Component Implementation: `TodaySessionCard`

Update the card to accept enriched session data:

```typescript
"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Share, User, Target, Calendar, Building } from "lucide-react";

// Existing utilities
import { CoachingSession } from "@/types/coaching-session";
import { formatDateInUserTimezoneWithTZ } from "@/lib/timezone-utils";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { cn } from "@/components/lib/utils";

// New utility types
import { SessionUrgency } from "@/lib/session-utils";

interface TodaySessionCardProps {
  session: CoachingSession;
  participantName: string;
  userRole: "Coach" | "Coachee";
  urgency: SessionUrgency;
  urgencyMessage: string;
  organizationName: string;
  isPast: boolean;
  userTimezone: string;
}

export function TodaySessionCard({
  session,
  participantName,
  userRole,
  urgency,
  urgencyMessage,
  organizationName,
  isPast,
  userTimezone,
}: TodaySessionCardProps) {

  // ============================================================================
  // Simple, focused helper functions
  // ============================================================================

  const handleCopyLink = async () => {
    await copyCoachingSessionLinkWithToast(session.id);
  };

  const getUrgencyStyles = (urgencyType: SessionUrgency) => {
    switch (urgencyType) {
      case "imminent":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800";
      case "soon":
        return "bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800";
      case "later":
        return "bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800";
      case "past":
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Use existing timezone utility for consistent formatting
  const formattedDateTime = formatDateInUserTimezoneWithTZ(
    session.date,
    userTimezone
  );

  // Extract just the time for the badge
  const timePart = formattedDateTime.split(" at ")[1] || "";

  return (
    <Card className="border-border shadow-sm max-w-2xl">
      {/* Status Indicator Section */}
      <div
        className={cn(
          "px-4 py-2 rounded-t-xl border-b flex items-center justify-between bg-sidebar",
          getUrgencyStyles(urgency)
        )}
      >
        <span className="text-sm font-medium">{urgencyMessage}</span>
        <Badge variant="secondary" className="bg-background/50">
          {timePart}
        </Badge>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Session Title (would come from goal in real implementation) */}
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          Coaching Session
        </h3>

        {/* Session Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>
              Meeting with: <span className="font-medium">{participantName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>
              Your role: <span className="font-medium">{userRole}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{formattedDateTime}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span className="font-medium">{organizationName}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Action Buttons */}
        <div className="flex gap-2 items-center">
          <Link href={`/coaching-sessions/${session.id}`}>
            <Button size="default">
              {isPast ? "View Session" : "Join Session"}
            </Button>
          </Link>

          <Button variant="outline" size="default" onClick={() => {}}>
            Reschedule
          </Button>

          <Button variant="ghost" size="icon" onClick={handleCopyLink}>
            <Share className="h-4 w-4" />
            <span className="sr-only">Copy session link</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

### Key Benefits of This Approach

1. **Readable as a Story**: Each chapter/section tells what it does
2. **Reuses Everything Possible**: Leverages all existing utilities and patterns
3. **Simple Functions**: Each helper does one thing with a clear name
4. **Type Safe**: Uses existing type definitions throughout
5. **Maintainable**: Easy to understand, modify, and debug
6. **Consistent**: Follows existing codebase conventions exactly

---

## Test-Driven Development (TDD) Approach

### TDD Philosophy for This Feature

**Red → Green → Refactor**: Write failing tests first, make them pass with minimal code, then refactor for clarity.

Each phase follows this pattern:
1. **Write the test** (describing expected behavior)
2. **Watch it fail** (confirming the test works)
3. **Write minimal code** to make it pass
4. **Refactor** for readability (our story-driven approach)
5. **Verify all tests still pass**

### Test File Structure

```
src/
├── lib/
│   ├── session-utils.ts
│   └── __tests__/
│       └── session-utils.test.ts
└── components/
    └── ui/
        └── dashboard/
            ├── todays-sessions.tsx
            ├── today-session-card.tsx
            └── __tests__/
                ├── todays-sessions.test.tsx
                ├── today-session-card.test.tsx
                └── test-utils.ts  # Shared mocks and helpers
```

### Phase 0: Test Setup and Mocks

**File**: `src/components/ui/dashboard/__tests__/test-utils.ts`

```typescript
import { DateTime } from "ts-luxon";
import { CoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Organization } from "@/types/organization";
import { User } from "@/types/user";

/**
 * Test data factories for consistent, readable test setup
 * Story: "Create realistic test data that reads like a story"
 */

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: "user-1",
    email: "jim@example.com",
    first_name: "Jim",
    last_name: "Hodapp",
    display_name: "Jim Hodapp",
    timezone: "America/Los_Angeles",
    role: "coach",
    roles: [],
    ...overrides,
  };
}

export function createMockOrganization(overrides?: Partial<Organization>): Organization {
  return {
    id: "org-1",
    name: "Refactor Group",
    slug: "refactor-group",
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
    ...overrides,
  };
}

export function createMockRelationship(
  overrides?: Partial<CoachingRelationshipWithUserNames>
): CoachingRelationshipWithUserNames {
  return {
    id: "rel-1",
    coach_id: "user-1",
    coachee_id: "user-2",
    organization_id: "org-1",
    coach_first_name: "Jim",
    coach_last_name: "Hodapp",
    coachee_first_name: "Caleb",
    coachee_last_name: "Bourg",
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
    ...overrides,
  };
}

export function createMockSession(overrides?: Partial<CoachingSession>): CoachingSession {
  return {
    id: "session-1",
    coaching_relationship_id: "rel-1",
    date: DateTime.now().plus({ hours: 2 }).toISO(), // 2 hours from now by default
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
    ...overrides,
  };
}

/**
 * Create a session at a specific time relative to "now"
 * Story: "Make it easy to test different time scenarios"
 */
export function createSessionAt(minutesFromNow: number): CoachingSession {
  return createMockSession({
    date: DateTime.now().plus({ minutes: minutesFromNow }).toISO(),
  });
}
```

### Phase 1: Test Utility Functions (`session-utils.ts`)

**File**: `src/lib/__tests__/session-utils.test.ts`

```typescript
import { DateTime } from "ts-luxon";
import {
  calculateSessionUrgency,
  getUrgencyMessage,
  getParticipantName,
  getUserRole,
  enrichSessionForDisplay,
} from "../session-utils";
import {
  createMockSession,
  createMockRelationship,
  createSessionAt,
} from "../../components/ui/dashboard/__tests__/test-utils";

describe("calculateSessionUrgency", () => {
  it("returns 'past' for sessions that already happened", () => {
    // Test Story: "Session was 30 minutes ago → should be 'past'"
    const session = createSessionAt(-30);
    const urgency = calculateSessionUrgency(session.date);
    expect(urgency).toBe("past");
  });

  it("returns 'imminent' for sessions starting within 1 hour", () => {
    // Test Story: "Session in 45 minutes → should be 'imminent'"
    const session = createSessionAt(45);
    const urgency = calculateSessionUrgency(session.date);
    expect(urgency).toBe("imminent");
  });

  it("returns 'soon' for sessions starting within 3 hours", () => {
    // Test Story: "Session in 2 hours → should be 'soon'"
    const session = createSessionAt(120);
    const urgency = calculateSessionUrgency(session.date);
    expect(urgency).toBe("soon");
  });

  it("returns 'later' for sessions more than 3 hours away", () => {
    // Test Story: "Session in 5 hours → should be 'later'"
    const session = createSessionAt(300);
    const urgency = calculateSessionUrgency(session.date);
    expect(urgency).toBe("later");
  });
});

describe("getUrgencyMessage", () => {
  it("shows 'Session ended' for past sessions", () => {
    const session = createSessionAt(-30);
    const message = getUrgencyMessage(session.date);
    expect(message).toBe("Session ended");
  });

  it("shows 'Starting now!' for sessions within 5 minutes", () => {
    const session = createSessionAt(3);
    const message = getUrgencyMessage(session.date);
    expect(message).toBe("Starting now!");
  });

  it("shows countdown for sessions within 1 hour", () => {
    const session = createSessionAt(45);
    const message = getUrgencyMessage(session.date);
    expect(message).toBe("Next session in 45 minutes");
  });

  it("handles singular minute correctly", () => {
    const session = createSessionAt(1);
    const message = getUrgencyMessage(session.date);
    expect(message).toBe("Next session in 1 minute");
  });

  it("shows 'Starting soon' for sessions 1-3 hours away", () => {
    const session = createSessionAt(90);
    const message = getUrgencyMessage(session.date);
    expect(message).toBe("Starting soon");
  });

  it("shows time of day for morning sessions", () => {
    const morningSession = createMockSession({
      date: DateTime.now().set({ hour: 9, minute: 0 }).toISO(),
    });
    const message = getUrgencyMessage(morningSession.date);
    expect(message).toBe("Scheduled for this morning");
  });

  it("shows time of day for afternoon sessions", () => {
    const afternoonSession = createMockSession({
      date: DateTime.now().set({ hour: 14, minute: 0 }).toISO(),
    });
    const message = getUrgencyMessage(afternoonSession.date);
    expect(message).toBe("Scheduled for this afternoon");
  });

  it("shows time of day for evening sessions", () => {
    const eveningSession = createMockSession({
      date: DateTime.now().set({ hour: 19, minute: 0 }).toISO(),
    });
    const message = getUrgencyMessage(eveningSession.date);
    expect(message).toBe("Scheduled for this evening");
  });
});

describe("getParticipantName", () => {
  it("returns coachee name when user is the coach", () => {
    const relationship = createMockRelationship({
      coach_id: "user-1",
      coachee_first_name: "Caleb",
      coachee_last_name: "Bourg",
    });
    const name = getParticipantName(relationship, "user-1");
    expect(name).toBe("Caleb Bourg");
  });

  it("returns coach name when user is the coachee", () => {
    const relationship = createMockRelationship({
      coach_id: "user-2",
      coachee_id: "user-1",
      coach_first_name: "Sarah",
      coach_last_name: "Chen",
    });
    const name = getParticipantName(relationship, "user-1");
    expect(name).toBe("Sarah Chen");
  });
});

describe("getUserRole", () => {
  it("returns 'Coach' when user is the coach", () => {
    const relationship = createMockRelationship({ coach_id: "user-1" });
    const role = getUserRole(relationship, "user-1");
    expect(role).toBe("Coach");
  });

  it("returns 'Coachee' when user is the coachee", () => {
    const relationship = createMockRelationship({ coachee_id: "user-1" });
    const role = getUserRole(relationship, "user-1");
    expect(role).toBe("Coachee");
  });
});

describe("enrichSessionForDisplay", () => {
  it("combines all session data with calculated values", () => {
    const session = createSessionAt(45);
    const relationship = createMockRelationship();
    const enriched = enrichSessionForDisplay(
      session,
      relationship,
      "Refactor Group",
      "user-1"
    );

    expect(enriched.session).toBe(session);
    expect(enriched.relationship).toBe(relationship);
    expect(enriched.participantName).toBe("Caleb Bourg");
    expect(enriched.userRole).toBe("Coach");
    expect(enriched.urgency).toBe("imminent");
    expect(enriched.urgencyMessage).toBe("Next session in 45 minutes");
    expect(enriched.organizationName).toBe("Refactor Group");
    expect(enriched.isPast).toBe(false);
  });

  it("correctly identifies past sessions", () => {
    const session = createSessionAt(-30);
    const relationship = createMockRelationship();
    const enriched = enrichSessionForDisplay(
      session,
      relationship,
      "Refactor Group",
      "user-1"
    );

    expect(enriched.isPast).toBe(true);
    expect(enriched.urgency).toBe("past");
  });
});
```

### Phase 2: Test Session Card Component

**File**: `src/components/ui/dashboard/__tests__/today-session-card.test.tsx`

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodaySessionCard } from "../today-session-card";
import { createMockSession, createSessionAt } from "./test-utils";

// Mock the copy function
jest.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: jest.fn(),
}));

describe("TodaySessionCard", () => {
  const defaultProps = {
    session: createSessionAt(45),
    participantName: "Caleb Bourg",
    userRole: "Coach" as const,
    urgency: "imminent" as const,
    urgencyMessage: "Next session in 45 minutes",
    organizationName: "Refactor Group",
    isPast: false,
    userTimezone: "America/Los_Angeles",
  };

  it("displays urgency message prominently", () => {
    render(<TodaySessionCard {...defaultProps} />);
    expect(screen.getByText("Next session in 45 minutes")).toBeInTheDocument();
  });

  it("shows participant name", () => {
    render(<TodaySessionCard {...defaultProps} />);
    expect(screen.getByText(/Caleb Bourg/)).toBeInTheDocument();
  });

  it("shows user role", () => {
    render(<TodaySessionCard {...defaultProps} />);
    expect(screen.getByText(/Coach/)).toBeInTheDocument();
  });

  it("shows organization name", () => {
    render(<TodaySessionCard {...defaultProps} />);
    expect(screen.getByText(/Refactor Group/)).toBeInTheDocument();
  });

  it("shows 'Join Session' button for upcoming sessions", () => {
    render(<TodaySessionCard {...defaultProps} isPast={false} />);
    expect(screen.getByRole("button", { name: /Join Session/ })).toBeInTheDocument();
  });

  it("shows 'View Session' button for past sessions", () => {
    render(<TodaySessionCard {...defaultProps} isPast={true} urgency="past" />);
    expect(screen.getByRole("button", { name: /View Session/ })).toBeInTheDocument();
  });

  it("applies imminent urgency styling", () => {
    const { container } = render(<TodaySessionCard {...defaultProps} urgency="imminent" />);
    const statusSection = container.querySelector(".bg-amber-50");
    expect(statusSection).toBeInTheDocument();
  });

  it("applies past urgency styling", () => {
    const { container } = render(<TodaySessionCard {...defaultProps} urgency="past" />);
    const statusSection = container.querySelector(".bg-muted");
    expect(statusSection).toBeInTheDocument();
  });

  it("has reschedule button", () => {
    render(<TodaySessionCard {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Reschedule/ })).toBeInTheDocument();
  });

  it("has share button", () => {
    render(<TodaySessionCard {...defaultProps} />);
    expect(screen.getByLabelText(/Copy session link/)).toBeInTheDocument();
  });

  it("calls copy function when share button clicked", async () => {
    const { copyCoachingSessionLinkWithToast } = require("@/components/ui/share-session-link");
    render(<TodaySessionCard {...defaultProps} />);

    const shareButton = screen.getByLabelText(/Copy session link/);
    await userEvent.click(shareButton);

    expect(copyCoachingSessionLinkWithToast).toHaveBeenCalledWith(defaultProps.session.id);
  });
});
```

### Phase 3: Test TodaysSessions Container Component

**File**: `src/components/ui/dashboard/__tests__/todays-sessions.test.tsx`

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import { TodaysSessions } from "../todays-sessions";
import {
  createMockUser,
  createMockOrganization,
  createMockRelationship,
  createSessionAt,
} from "./test-utils";

// Mock all API hooks
jest.mock("@/lib/api/organizations");
jest.mock("@/lib/api/coaching-relationships");
jest.mock("@/lib/api/coaching-sessions");
jest.mock("@/lib/providers/auth-store-provider");

describe("TodaysSessions", () => {
  beforeEach(() => {
    // Setup default mocks
    const { useAuthStore } = require("@/lib/providers/auth-store-provider");
    useAuthStore.mockReturnValue({
      userSession: createMockUser(),
    });
  });

  it("shows welcome message with user first name", () => {
    render(<TodaysSessions />);
    expect(screen.getByText(/Welcome Jim!/)).toBeInTheDocument();
  });

  it("shows 'Today's Sessions' subheader", () => {
    render(<TodaysSessions />);
    expect(screen.getByText("Today's Sessions")).toBeInTheDocument();
  });

  it("shows empty state when no sessions", async () => {
    const { useOrganizationList } = require("@/lib/api/organizations");
    useOrganizationList.mockReturnValue({
      organizations: [],
      isLoading: false,
      isError: false,
    });

    render(<TodaysSessions />);

    await waitFor(() => {
      expect(screen.getByText(/No coaching sessions scheduled for today/)).toBeInTheDocument();
    });
  });

  it("renders carousel when sessions exist", async () => {
    // Mock API responses
    const { useOrganizationList } = require("@/lib/api/organizations");
    const { useCoachingRelationshipList } = require("@/lib/api/coaching-relationships");
    const { useCoachingSessionList } = require("@/lib/api/coaching-sessions");

    useOrganizationList.mockReturnValue({
      organizations: [createMockOrganization()],
      isLoading: false,
      isError: false,
    });

    useCoachingRelationshipList.mockReturnValue({
      relationships: [createMockRelationship()],
      isLoading: false,
      isError: false,
    });

    useCoachingSessionList.mockReturnValue({
      coachingSessions: [
        createSessionAt(45),
        createSessionAt(120),
      ],
      isLoading: false,
      isError: false,
    });

    render(<TodaysSessions />);

    await waitFor(() => {
      // Should render session cards
      expect(screen.getAllByText(/Meeting with:/)).toHaveLength(2);
    });
  });

  it("shows navigation controls when multiple sessions exist", async () => {
    // Setup mocks for multiple sessions
    const { useOrganizationList } = require("@/lib/api/organizations");
    const { useCoachingRelationshipList } = require("@/lib/api/coaching-relationships");
    const { useCoachingSessionList } = require("@/lib/api/coaching-sessions");

    useOrganizationList.mockReturnValue({
      organizations: [createMockOrganization()],
      isLoading: false,
      isError: false,
    });

    useCoachingRelationshipList.mockReturnValue({
      relationships: [createMockRelationship()],
      isLoading: false,
      isError: false,
    });

    useCoachingSessionList.mockReturnValue({
      coachingSessions: [
        createSessionAt(30),
        createSessionAt(90),
        createSessionAt(180),
      ],
      isLoading: false,
      isError: false,
    });

    render(<TodaysSessions />);

    await waitFor(() => {
      // Should show navigation buttons
      expect(screen.getByLabelText(/Previous session/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Next session/)).toBeInTheDocument();

      // Should show dot indicators (3 sessions = 3 dots)
      const dots = screen.getAllByLabelText(/Go to session/);
      expect(dots).toHaveLength(3);
    });
  });

  it("hides navigation controls when only one session exists", async () => {
    const { useOrganizationList } = require("@/lib/api/organizations");
    const { useCoachingRelationshipList } = require("@/lib/api/coaching-relationships");
    const { useCoachingSessionList } = require("@/lib/api/coaching-sessions");

    useOrganizationList.mockReturnValue({
      organizations: [createMockOrganization()],
      isLoading: false,
      isError: false,
    });

    useCoachingRelationshipList.mockReturnValue({
      relationships: [createMockRelationship()],
      isLoading: false,
      isError: false,
    });

    useCoachingSessionList.mockReturnValue({
      coachingSessions: [createSessionAt(45)],
      isLoading: false,
      isError: false,
    });

    render(<TodaysSessions />);

    await waitFor(() => {
      // Should NOT show navigation
      expect(screen.queryByLabelText(/Previous session/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/Next session/)).not.toBeInTheDocument();
    });
  });

  it("filters sessions to only show today's sessions", async () => {
    // Test that sessions from other days are filtered out
    const { useCoachingSessionList } = require("@/lib/api/coaching-sessions");

    useCoachingSessionList.mockReturnValue({
      coachingSessions: [
        createSessionAt(45), // Today
        createMockSession({ date: DateTime.now().plus({ days: 1 }).toISO() }), // Tomorrow
        createMockSession({ date: DateTime.now().minus({ days: 1 }).toISO() }), // Yesterday
      ],
      isLoading: false,
      isError: false,
    });

    render(<TodaysSessions />);

    await waitFor(() => {
      // Should only render 1 session card (today's session)
      const sessionCards = screen.getAllByText(/Meeting with:/);
      expect(sessionCards).toHaveLength(1);
    });
  });

  it("sorts sessions chronologically", async () => {
    const { useCoachingSessionList } = require("@/lib/api/coaching-sessions");

    // Create sessions in random order
    useCoachingSessionList.mockReturnValue({
      coachingSessions: [
        createSessionAt(180), // 3 hours from now
        createSessionAt(30),  // 30 minutes from now
        createSessionAt(120), // 2 hours from now
      ],
      isLoading: false,
      isError: false,
    });

    render(<TodaysSessions />);

    await waitFor(() => {
      const urgencyMessages = screen.getAllByText(/Next session in|Starting soon|Scheduled for/);
      // First should be the soonest (30 min)
      expect(urgencyMessages[0]).toHaveTextContent("Next session in 30 minutes");
    });
  });
});
```

### TDD Implementation Workflow

**Step 1: Create `session-utils.test.ts`**
```bash
# Write all tests for session-utils.ts
# Run tests → ALL FAIL (Red)
npm test session-utils.test.ts
```

**Step 2: Implement `session-utils.ts`**
```bash
# Write minimal code to make tests pass
# Run tests → ALL PASS (Green)
npm test session-utils.test.ts

# Refactor for readability (story-driven code)
# Run tests → STILL PASS
npm test session-utils.test.ts
```

**Step 3: Create `today-session-card.test.tsx`**
```bash
# Write all tests for TodaySessionCard
# Run tests → ALL FAIL (Red)
npm test today-session-card.test.tsx
```

**Step 4: Implement `TodaySessionCard`**
```bash
# Write minimal code to make tests pass
# Run tests → ALL PASS (Green)
npm test today-session-card.test.tsx

# Refactor for readability
# Run tests → STILL PASS
npm test today-session-card.test.tsx
```

**Step 5: Create `todays-sessions.test.tsx`**
```bash
# Write all tests for TodaysSessions
# Run tests → ALL FAIL (Red)
npm test todays-sessions.test.tsx
```

**Step 6: Implement `TodaysSessions`**
```bash
# Write minimal code to make tests pass
# Run tests → ALL PASS (Green)
npm test todays-sessions.test.tsx

# Refactor for readability (chapter-driven structure)
# Run tests → STILL PASS
npm test todays-sessions.test.tsx
```

**Step 7: Full Test Suite**
```bash
# Run all tests together
npm test

# Check coverage
npm test -- --coverage
```

### Test Coverage Goals

- **Utility Functions**: 100% coverage
- **Components**: >90% coverage
- **Edge Cases**: All identified scenarios tested
- **Integration**: Key user workflows tested end-to-end

### Benefits of TDD Approach

1. **Confidence**: Tests prove the code works before refactoring
2. **Documentation**: Tests describe expected behavior clearly
3. **Regression Prevention**: Changes won't break existing functionality
4. **Design Feedback**: Writing tests first reveals design issues early
5. **Refactoring Safety**: Can refactor boldly knowing tests will catch breaks

## Visual Design

### UI/UX Experiment: Carousel-Based Design

**Rationale**: To create a more engaging, modern dashboard experience, we'll experiment with a carousel-based layout for today's sessions instead of a traditional vertical list. This approach:
- Reduces vertical scroll on the dashboard
- Creates visual focus on one session at a time
- Provides a modern, card-based interaction pattern
- Allows for richer session card design with more information density

**Component**: shadcn Carousel component
- Documentation: https://ui.shadcn.com/docs/components/carousel
- Installation: `npx shadcn@latest add carousel`
- Underlying library: Embla Carousel

### Layout Specification - Carousel Design

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Welcome Jim!                                          │   │
│  │ Today's Sessions                                      │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                        │   │
│  │ [◀] ┌────────────────────────────────────────┐ [▶]   │   │
│  │     │                                        │       │   │
│  │     │  Total Revenue           ↗ +12.5%     │       │   │
│  │     │  $1,250.00                             │       │   │
│  │     │                                        │       │   │
│  │     │  Q4 Product Launch Strategy            │       │   │
│  │     │                                        │       │   │
│  │     │  🎯 Coach: Jim Hodapp                  │       │   │
│  │     │  👤 Coachee: Caleb Bourg               │       │   │
│  │     │  📅 Today at 10:00 AM PST              │       │   │
│  │     │                                        │       │   │
│  │     │              [Join Session]            │       │   │
│  │     │                                        │       │   │
│  │     └────────────────────────────────────────┘       │   │
│  │                    ● ○ ○                             │   │
│  │                                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Add New                                               │   │
│  │  ...                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Carousel Card Visual Reference**: Inspired by the shadcn dashboard cards with:
- Large prominent metric area at top (repurposed for session status/timing)
- Clear hierarchy with large numbers and trend indicators
- Muted text for secondary information
- Rounded corners and subtle shadows
- Clean, spacious layout

### Carousel Session Card Design

Each carousel card will follow this structure (inspired by the shadcn revenue/metrics cards):

```
┌────────────────────────────────────────┐
│                                        │
│  [Status Indicator]       [Time Badge] │  ← Top section with status
│  Next Session in 45 mins      10:00 AM │
│                                        │
│  ─────────────────────────────────────│
│                                        │
│  Q4 Product Launch Strategy            │  ← Session title (large)
│                                        │
│  👤 Meeting with: Caleb Bourg          │  ← Who they're meeting
│  🎯 Your role: Coach                   │  ← Their role
│  📅 Today at 10:00 AM PST              │  ← Full date/time
│  🏢 Refactor Group                     │  ← Organization (if multi-org)
│                                        │
│  ─────────────────────────────────────│
│                                        │
│        [Join Session]    [⋮ More]      │  ← Action buttons
│                                        │
└────────────────────────────────────────┘
```

### Card Styling (Matching shadcn Dashboard Style)

**Overall Card**:
- Background: `bg-card` (white in light mode, dark in dark mode)
- Border: `border border-border`
- Rounded: `rounded-xl`
- Shadow: `shadow-sm`
- Padding: `p-6` (generous spacing like revenue cards)
- Min height: `min-h-[320px]` (substantial card presence)
- Width: Full width of carousel container with `max-w-md` center constraint

**Status Section** (Top):
- Background: Subtle gradient or solid based on urgency
  - Upcoming soon (<1hr): `bg-amber-50 dark:bg-amber-950/20` with `text-amber-900 dark:text-amber-100`
  - Later today: `bg-blue-50 dark:bg-blue-950/20` with `text-blue-900 dark:text-blue-100`
  - Past: `bg-muted` with `text-muted-foreground`
- Typography: `text-sm font-medium`
- Badge for time: `badge` component with `variant="secondary"`
- Padding: `p-4 -mt-6 -mx-6 mb-4 rounded-t-xl`

**Session Title**:
- Typography: `text-2xl font-bold tracking-tight` (like $1,250.00 in reference)
- Color: `text-foreground`
- Margin: `mb-4`

**Session Details**:
- Layout: Vertical stack with `space-y-2`
- Typography: `text-sm text-muted-foreground`
- Icons: Lucide icons with `h-4 w-4 inline-block mr-2`
- Each detail row: `flex items-center gap-2`

**Divider**:
- `border-t border-border my-4`

**Action Buttons**:
- Layout: `flex gap-2 justify-between items-center`
- Primary (Join): `<Button className="flex-1">Join Session</Button>`
- Secondary (More): `<Button variant="ghost" size="icon"><MoreHorizontal /></Button>`

**Trend/Status Indicator** (Optional, top-right):
- Small badge: `text-xs font-medium px-2 py-1 rounded-md`
- Colors match status urgency
- Example: "Starting soon" with up arrow icon

### Carousel Configuration

**Carousel Props**:
```tsx
<Carousel
  opts={{
    align: "start",
    loop: false,
  }}
  className="w-full max-w-4xl mx-auto"
>
  <CarouselContent>
    {todaysSessions.map((session) => (
      <CarouselItem key={session.id}>
        <TodaySessionCard session={session} relationship={...} />
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>
```

**Carousel Features**:
- Navigation arrows on hover (desktop) or always visible (mobile)
- Dot indicators showing total sessions and current position
- Keyboard navigation (arrow keys)
- Touch/swipe gestures on mobile
- Auto-sizing based on content
- Responsive breakpoints:
  - Mobile: Single card, full width
  - Tablet: Single card, max-width constraint
  - Desktop: Single card, centered with max-width

**Dot Indicators**:
```tsx
<div className="flex justify-center gap-2 mt-4">
  {todaysSessions.map((_, index) => (
    <button
      key={index}
      className={cn(
        "h-2 w-2 rounded-full transition-all",
        index === currentIndex
          ? "bg-primary w-4"
          : "bg-muted-foreground/30"
      )}
      onClick={() => api?.scrollTo(index)}
    />
  ))}
</div>
```

### Responsive Behavior

**Mobile (< 768px)**:
- Single card at 100% width with horizontal padding
- Navigation arrows positioned outside card edges
- Swipe gesture primary interaction
- Dot indicators below card

**Tablet (768px - 1024px)**:
- Single card at max 80% width, centered
- Visible navigation arrows
- Dot indicators below

**Desktop (> 1024px)**:
- Single card at max 600px width, centered
- Arrows appear on hover outside card
- Keyboard navigation emphasized
- Dot indicators with hover effects

### Styling Guidelines

**Component**: Card-based design within Carousel container
**Spacing**:
- `mb-8` margin below TodaysSessions component (same as AddEntities)
- `gap-4` between carousel controls
- `p-6` card padding (generous like revenue cards)

**Typography**:
- Title (Welcome): `text-2xl font-semibold tracking-tight`
- Subheader: `text-sm text-muted-foreground mb-6`
- Session goal: `text-2xl font-bold tracking-tight`
- Session details: `text-sm text-muted-foreground`
- Status text: `text-sm font-medium`

**Colors**: Use existing theme colors matching shadcn dashboard
- Card background: `bg-card border-border`
- Text: `text-foreground` for primary, `text-muted-foreground` for secondary
- Status backgrounds: Semantic colors (amber/blue/muted)
- Button: Primary button styling for "Join Session"
- Past sessions: Muted status indicator

**Icons**:
- Size: `h-4 w-4` for inline icons
- Color: Match surrounding text color
- Library: Lucide React (already in project)
- Examples: `User`, `Target`, `Calendar`, `Building`

### Empty States

**No sessions today**:
```
┌────────────────────────────────────────┐
│ Welcome Jim!                           │
│ Your session schedule for today        │
├────────────────────────────────────────┤
│                                        │
│  No coaching sessions scheduled        │
│  for today. Enjoy your day!            │
│                                        │
└────────────────────────────────────────┘
```

**Loading state**:
```
┌────────────────────────────────────────┐
│ Welcome Jim!                           │
│ Your session schedule for today        │
├────────────────────────────────────────┤
│                                        │
│  Loading your schedule...              │
│  [Skeleton cards or spinner]           │
│                                        │
└────────────────────────────────────────┘
```

**Error state**:
```
┌────────────────────────────────────────┐
│ Welcome Jim!                           │
│ Your session schedule for today        │
├────────────────────────────────────────┤
│                                        │
│  ⚠ Unable to load your schedule.       │
│  Please try refreshing the page.       │
│                                        │
└────────────────────────────────────────┘
```

## Implementation Checklist

### Phase 0: Setup Carousel Component
- [x] Install shadcn Carousel component
  ```bash
  npx shadcn@latest add carousel
  ```
  - This will install the Carousel, CarouselContent, CarouselItem, CarouselPrevious, and CarouselNext components
  - Underlying library: Embla Carousel (automatically installed as dependency)
- [x] Verify installation
  - Check `components/ui/carousel.tsx` exists
  - Check `package.json` includes `embla-carousel-react`
- [x] Fix import path in `carousel.tsx` from `@/lib/utils` to `@/components/lib/utils`

### Phase 1: Core Component (MVP) - Carousel Implementation - PROTOTYPE WITH MOCK DATA
- [x] Create `TodaySessionCard` component (`components/ui/dashboard/today-session-card.tsx`)
  - [x] Implement status indicator section with urgency-based coloring
  - [x] Display session goal as large prominent title
  - [x] Show meeting participant (coach or coachee name based on user role)
  - [x] Display user's role (Coach/Coachee) with icon
  - [x] Show formatted date/time in user timezone
  - [x] Include organization name if user belongs to multiple orgs
  - [x] Join/View button logic based on `isPastSession()`
  - [x] Share session link button using `copyCoachingSessionLinkWithToast` utility
  - [x] Reschedule button placeholder
  - [x] Apply shadcn dashboard card styling (matching revenue cards)
  - [x] Responsive layout with proper width constraints (`max-w-2xl`)
  - [x] Header styling: reduced padding (`px-4 py-2`), sidebar background color
  - [x] Button layout: compact sizing without excessive width

- [x] Create `TodaysSessions` container component (`components/ui/dashboard/todays-sessions.tsx`)
  - [x] Mock user session data (first_name, timezone)
  - [x] Mock 3 sample sessions with different urgency levels
  - [x] Sort sessions chronologically by date/time
  - [x] Calculate session urgency (for status indicator coloring)
  - [x] Implement Carousel with proper configuration
  - [x] Position navigation arrows below carousel (not on sides)
  - [x] Add dot indicators with current position highlighting
  - [x] Handle empty states (friendly "No sessions" message in card format)
  - [x] Implement keyboard navigation support (via Embla Carousel)
  - [x] Add touch/swipe gesture support for mobile (via Embla Carousel)
  - [x] Structure matching other dashboard components (using `space-y-4`)
  - [x] Remove width constraints from carousel, use `max-w-2xl` wrapper
  - [x] Center carousel navigation buttons to card width
  - [ ] Replace mock data with real API calls:
    - [ ] Fetch user session data from auth store (first_name, timezone)
    - [ ] Aggregate coaching relationships across all user organizations
    - [ ] Fetch sessions for today across all relationships (parallel fetching)
    - [ ] Filter sessions to current day in user timezone using `isSessionToday()`
  - [ ] Handle loading states (skeleton or spinner in carousel)
  - [ ] Handle error states (error message in card format)

- [x] Update `DashboardContainer` (`components/ui/dashboard/dashboard-container.tsx`)
  - [x] Import and render `TodaysSessions` above `AddEntities`
  - [x] Maintain existing layout and spacing
  - [x] Ensure responsive behavior

### Implementation Notes & Lessons Learned

**Width Constraint Issues Resolved**:
- Root cause: `PageContainer` has `[&>*]:w-full` forcing all direct children to full width
- Solution: Added `max-w-2xl` to both carousel wrapper and navigation controls
- Pattern: Match existing dashboard components like `AddEntities` using `space-y-4` structure
- Card alignment: Left-aligned without `mx-auto`, matches other dashboard cards

**Carousel Customization**:
- Override default spacing: `ml-0` on `CarouselContent`, `pl-0` on `CarouselItem`
- Navigation positioned below card instead of on sides
- Both carousel and navigation wrapped in `max-w-2xl` for consistent width
- Responsive padding handled by `PageContainer`

**Component Structure**:
```tsx
<div className="space-y-4">
  <h3>Welcome {name}!</h3>
  <p>Today's Sessions</p>

  <div className="max-w-2xl">
    <Carousel>...</Carousel>
  </div>

  <div className="max-w-2xl">
    <div className="flex items-center justify-center gap-4">
      {/* Navigation controls */}
    </div>
  </div>
</div>
```

**Real-Time Updates Strategy**:
Time-based displays need to stay current as the user remains on the dashboard. Implementation approach:

1. **Interval Timer for Urgency Updates**:
   ```tsx
   // Update urgency calculations every 60 seconds
   useEffect(() => {
     const interval = setInterval(() => {
       // Recalculate urgency for all sessions
       setSessionsWithUrgency(calculateUrgency(sessions));
     }, 60000); // 60 seconds

     return () => clearInterval(interval);
   }, [sessions]);
   ```

2. **Session Transition Detection**:
   - When a session's start time is reached, automatically update status from "upcoming" to "in progress"
   - When a session's end time is reached (estimated duration), update status from "in progress" to "past"
   - Change button text from "Join Session" to "View Session" when session becomes past

3. **Urgency Message Updates**:
   - "Starting in 45 minutes" → "Starting in 44 minutes" → ... → "Starting now!"
   - "Scheduled for this afternoon" → "Starting in 45 minutes" (when < 1 hour away)
   - "In progress" (when current time is between start and estimated end)

4. **Visual Indicators**:
   - Urgency background color transitions:
     - `later` (>1hr away) → `soon` (<1hr away) → `imminent` (<15min away)
   - Pulse animation when session is imminent (<5 minutes)
   - Badge changes from time display to "NOW" when session starts

5. **Performance Considerations**:
   - Use `useMemo` to cache urgency calculations
   - Only recalculate when timer fires or sessions change
   - Debounce rapid updates to prevent thrashing
   - Stop timer when user navigates away (cleanup in useEffect)

6. **Edge Cases**:
   - Page visibility: Pause timer when tab is hidden, resume when visible
   - Session removal: Filter out sessions that have ended >2 hours ago
   - Empty state transition: Show "No more sessions today" when all sessions are past
   - Midnight boundary: Reset component at midnight to clear old sessions
   - Component hiding: Hide entire component when no upcoming sessions remain

**Implementation Example**:
```tsx
const calculateUrgency = (session: MockSession): SessionUrgency => {
  const now = DateTime.now();
  const sessionTime = DateTime.fromISO(session.dateTime);
  const diffMinutes = sessionTime.diff(now, 'minutes').minutes;

  if (diffMinutes < 0) {
    return { type: 'past', message: 'Session ended' };
  } else if (diffMinutes < 15) {
    return { type: 'imminent', message: 'Starting now!' };
  } else if (diffMinutes < 60) {
    return {
      type: 'imminent',
      message: `Starting in ${Math.round(diffMinutes)} minutes`
    };
  } else if (diffMinutes < 180) {
    return { type: 'soon', message: 'Starting soon' };
  } else {
    return { type: 'later', message: 'Scheduled for this afternoon' };
  }
};
```

**Future Enhancement - Page Visibility API**:
```tsx
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      clearInterval(timerRef.current);
    } else {
      // Recalculate immediately when tab becomes visible
      setSessionsWithUrgency(calculateUrgency(sessions));
      // Restart timer
      timerRef.current = setInterval(updateUrgency, 60000);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(timerRef.current);
  };
}, [sessions]);
```

**When All Sessions Are Past**:

The component handles the transition from active sessions to no remaining sessions gracefully:

1. **Filtering Strategy**:
   ```tsx
   // Show ALL sessions scheduled for today, regardless of whether they've passed
   // Sessions are only removed at midnight when the day resets
   const todaysSessions = sessions.filter(session => isSessionToday(session));

   // No filtering by hours - keep all sessions for the entire day
   ```

2. **Progressive States**:
   - **All upcoming**: Normal carousel display with "Join Session" buttons
   - **Mixed (some past, some future)**: Show all in chronological order
     - Past sessions: Muted styling with "past" urgency type, "View Session" button
     - Future sessions: Urgency-based styling, "Join Session" button
   - **All past**: Continue showing carousel with "View Session" buttons and muted styling
   - **After midnight reset**: Show empty state message if no new sessions scheduled

3. **Empty State Display** (Selected Approach):
   ```tsx
   // In TodaysSessions component
   if (activeSessions.length === 0) {
     return (
       <Card className="mb-8">
         <CardHeader>
           <CardTitle className="text-2xl font-semibold tracking-tight">
             Welcome {MOCK_USER.first_name}!
           </CardTitle>
           <p className="text-sm text-muted-foreground">Today's Sessions</p>
         </CardHeader>
         <CardContent>
           <div className="flex items-center justify-center py-12">
             <p className="text-muted-foreground">
               No more coaching sessions scheduled for today. Great work!
             </p>
           </div>
         </CardContent>
       </Card>
     );
   }
   ```

   **Rationale for showing empty state instead of hiding**:
   - Maintains consistent dashboard layout throughout the day
   - Provides positive feedback that sessions are complete
   - Avoids jarring layout shift when component disappears
   - User knows they checked their schedule (vs. wondering if component failed to load)

4. **Midnight Reset**:
   ```tsx
   useEffect(() => {
     const now = DateTime.now();
     const tomorrow = now.plus({ days: 1 }).startOf('day');
     const msUntilMidnight = tomorrow.diff(now).milliseconds;

     const midnightTimer = setTimeout(() => {
       // Refetch sessions for the new day
       refetchSessions();
     }, msUntilMidnight);

     return () => clearTimeout(midnightTimer);
   }, []);
   ```

5. **User Experience Flow**:
   - **9:00 AM**: User logs in, sees 3 sessions for today in carousel
   - **10:15 AM**: First session ends, still shows in carousel with "View Session" button and muted "past" styling
   - **2:00 PM**: Second session ends, carousel shows all 3 sessions (1 upcoming, 2 past)
   - **5:00 PM**: Last session ends, carousel shows all 3 sessions with "View Session" buttons and muted styling
   - **11:59 PM**: Still showing all 3 sessions from today
   - **12:00 AM (Midnight)**: Component resets and refetches - if no sessions scheduled for new day, shows empty state: "No coaching sessions scheduled for today. Enjoy your day!"
   - **New Day**: Component displays any sessions scheduled for the new day

### Phase 2: Enhancements
- [ ] Add urgency-based visual indicators
  - [ ] "Starting in X minutes" for sessions within 1 hour
  - [ ] Different background colors based on session urgency
  - [ ] Pulse animation or badge for imminent sessions (<15 mins)
- [ ] Enhanced carousel features
  - [ ] Auto-advance option (optional, user preference)
  - [ ] Transition animations between cards
  - [ ] Keyboard shortcuts (arrow keys, number keys for direct access)
- [ ] Session quick actions
  - [ ] Copy session link from card dropdown
  - [ ] Edit session (if user is coach)
  - [ ] Quick prep notes view
- [ ] Optimize with backend endpoint for better performance
  - [ ] Create `GET /api/coaching_sessions/today` endpoint
  - [ ] Replace frontend aggregation with single API call

### Phase 3: Testing
- [ ] Unit tests for `TodaySessionCard`
  - [ ] Renders session details correctly
  - [ ] Shows correct button text (Join vs View) based on session timing
  - [ ] Applies correct status indicator colors
  - [ ] Displays user role correctly (Coach/Coachee)
  - [ ] Formats date/time using user timezone
- [ ] Unit tests for `TodaysSessions` data aggregation logic
  - [ ] Correctly aggregates sessions across multiple relationships
  - [ ] Filters to today only using `isSessionToday()`
  - [ ] Sorts sessions chronologically
  - [ ] Calculates urgency correctly
- [ ] Unit tests for timezone filtering
  - [ ] Sessions filtered correctly for different timezones
  - [ ] Handles midnight boundary cases
  - [ ] Respects user's stored timezone preference
- [ ] Integration test for dashboard rendering
  - [ ] TodaysSessions renders above AddEntities
  - [ ] Carousel initializes with correct session
  - [ ] Navigation arrows work correctly
  - [ ] Dot indicators reflect current position
- [ ] E2E test for carousel interactions
  - [ ] Swipe gestures work on mobile
  - [ ] Arrow key navigation works on desktop
  - [ ] Click navigation arrows to advance/go back
  - [ ] Click dot indicators to jump to specific session
- [ ] E2E test for user with multiple organizations
  - [ ] Sessions from all organizations appear
  - [ ] Organization name displays when user has multiple orgs
  - [ ] No duplicate sessions
- [ ] E2E test for edge cases
  - [ ] No sessions: Shows empty state in card format
  - [ ] Single session: Carousel still renders (no arrows needed)
  - [ ] Many sessions (5+): Carousel navigation works smoothly
  - [ ] Past sessions: Shows "View Session" instead of "Join"
  - [ ] Mixed past and future: Ordered chronologically

## Technical Considerations

### Performance Optimization
1. **Memoization**: Use `useMemo` for expensive filtering/sorting operations
2. **Parallel Fetching**: Fetch all relationship sessions concurrently
3. **Caching**: Leverage SWR's built-in caching for repeated data
4. **Conditional Rendering**: Only fetch/render if user has organizations

### Timezone Handling
- Always use user's `timezone` from `userSession`
- Use Luxon's `DateTime.setZone()` for timezone conversions
- Filter using `isSessionToday()` which respects timezone
- Display times using `formatDateInUserTimezoneWithTZ()`

### Edge Cases
1. **User with no organizations**: Show a state that let's the user know they need to be added to an Organization by an Org's Admin
2. **User with no coaching relationships**: Show a state that let's the user know they need to be assigned a coach before they can join a coaching session
3. **All sessions in the past**: Show "No upcoming sessions today"
4. **Sessions at midnight boundary**: Ensure correct day filtering
5. **Timezone changes**: Handle when user changes timezone setting
6. **Multiple sessions at same time**: Sort by creation date as tiebreaker

### Carousel-Specific Considerations

**Embla Carousel Integration**:
- Automatic dependency installation via shadcn CLI
- No manual configuration needed for basic use cases
- TypeScript support out of the box
- Lightweight bundle size impact (~15kb gzipped)

**State Management**:
```tsx
const [api, setApi] = useState<CarouselApi>();
const [current, setCurrent] = useState(0);
const [count, setCount] = useState(0);

useEffect(() => {
  if (!api) return;

  setCount(api.scrollSnapList().length);
  setCurrent(api.selectedScrollSnap() + 1);

  api.on("select", () => {
    setCurrent(api.selectedScrollSnap() + 1);
  });
}, [api]);
```

**Performance**:
- Lazy render: Only render current + adjacent cards initially
- Virtual scrolling not needed for typical use cases (< 10 sessions/day)
- Smooth CSS transitions for better perceived performance
- Debounce swipe gestures to prevent accidental navigation

**Browser Compatibility**:
- Modern browsers fully supported (Chrome, Firefox, Safari, Edge)
- Graceful degradation for older browsers (shows all cards in vertical stack)
- Touch events work on iOS and Android
- No polyfills required

**Fallback Strategy**:
If carousel proves problematic in testing:
1. **Option A**: Switch to horizontal scrollable container with snap points
2. **Option B**: Revert to vertical list with collapsible cards
3. **Option C**: Tabs-based navigation (like existing Coaching Sessions list)

Decision criteria for fallback:
- Carousel bugs or accessibility issues
- User feedback indicates confusion
- Performance issues on low-end devices
- Mobile usability problems

### Accessibility

**Carousel Accessibility**:
- Carousel wrapper: `role="region" aria-label="Today's coaching sessions"`
- Navigation buttons: `aria-label="Previous session" / "Next session"`
- Current position announcement: `aria-live="polite" aria-atomic="true"`
- Screen reader: Announces "Session 2 of 3" when navigating
- Keyboard navigation: Left/right arrows, Home/End keys
- Focus management: Focus moves to card content when navigating

**Card Accessibility**:
- Semantic HTML structure (article, header, section)
- ARIA labels for buttons ("Join session: {goal title}")
- Sufficient color contrast for status indicators (WCAG AA minimum)
- Touch targets minimum 44x44px for mobile
- Focus visible indicators for keyboard users

**Screen Reader Experience**:
- Loading state: "Loading your coaching sessions for today"
- Empty state: "No coaching sessions scheduled for today"
- Error state: "Unable to load your schedule. Please try refreshing the page."
- Session card: "{Goal title}. Meeting with {participant name}. Your role: {Coach/Coachee}. {Formatted date/time}. Button: Join session."

## Migration Path

### Breaking Changes
None - this is a new component addition.

### Data Migration
Not required - uses existing data structures.

### Rollout Strategy
1. Deploy component in "hidden" state with feature flag
2. Enable for internal testing team
3. Gather feedback and iterate
4. Enable for beta users
5. Full production rollout
6. Monitor performance metrics and user engagement

## Success Metrics

### Carousel UX Experiment Evaluation

**Quantitative Metrics** (A/B test if possible):
- **Engagement Rate**: % of users who interact with carousel vs. scrolling past
- **Navigation Pattern**: Carousel arrows vs. dot indicators vs. swipe usage
- **Time to Action**: Time from dashboard load to "Join Session" click
- **Completion Rate**: % of users who view all their sessions for the day
- **Bounce Rate**: % of users who leave carousel after viewing first card

**Qualitative Feedback** (user surveys/interviews):
- Does the carousel feel natural and intuitive?
- Is it easier to see today's schedule at a glance?
- Does the card design match user expectations?
- Are users finding the information they need quickly?
- Any friction points or confusion with carousel navigation?

**Decision Criteria for Carousel vs. Traditional List**:
Keep carousel if:
- ✅ Engagement rate > 70%
- ✅ Positive user feedback > 80%
- ✅ No accessibility issues identified
- ✅ Time to action improves or stays same vs. list
- ✅ Mobile usability score high

Switch to traditional list if:
- ❌ Users report confusion or frustration
- ❌ Accessibility score drops below requirements
- ❌ Mobile usability issues identified
- ❌ Performance degrades on lower-end devices
- ❌ Time to action increases significantly

### User Engagement
- % of users who click "Join Session" from Today's Sessions vs. main list
- Time saved navigating to today's sessions (target: 30% reduction)
- Reduction in support tickets about finding sessions (target: 50% reduction)
- Daily active usage of Today's Sessions component (target: >60% of users)

### Performance
- Component render time < 200ms
- API response time for all session data < 1s
- No impact on overall dashboard load time
- Carousel transition animations at 60fps
- First Contentful Paint (FCP) not degraded

### Quality
- Zero critical bugs in first 2 weeks
- < 5% error rate for session loading
- Accessibility score of 100 in Lighthouse
- WCAG 2.1 AA compliance verified
- Cross-browser compatibility confirmed (Chrome, Firefox, Safari, Edge)

## Future Enhancements

1. **Notifications**: Browser notifications 15 mins before session
2. **Calendar Integration**: Add to Google Calendar / Outlook
3. **Quick Actions**: Prep notes, view last session notes inline
4. **Filtering**: Show only sessions where user is coach/coachee
5. **Time Blocks**: Group sessions by time of day (Morning, Afternoon, Evening)
6. **Week View**: Expand to show upcoming week's sessions
7. **Customization**: User preference to hide/show this section

## Open Questions

1. **Should we include sessions that have already passed today?**
   - Recommendation: Yes, but style them differently (muted) and change to "View Session"

2. **What if a user has 20+ sessions today?**
   - Recommendation: Show all with scroll, add "collapse" option in Phase 2

3. **Should we cache the organization/relationship data?**
   - Recommendation: Yes, use SWR with 5-minute cache duration

4. **How do we handle users in multiple timezones (traveling)?**
   - Recommendation: Always use stored `userSession.timezone`, add ability to update timezone in user settings

5. **Should past sessions from today be clickable?**
   - Recommendation: Yes, change button to "View Session" instead of "Join Session"

## References

### Issue & Requirements
- Issue #160: Feature request for upcoming sessions list for today
- Updated requirements: Carousel-based design with shadcn dashboard card styling

### Existing Components
- `coaching-session-list.tsx`: Current session list implementation
- `coaching-session.tsx`: Individual session card component
- `dashboard-container.tsx`: Main dashboard layout

### API & Data
- `src/lib/api/coaching-sessions.ts`: Session API client and hooks
- `src/types/coaching-session.ts`: Session data models and utility functions
- `src/types/coaching_relationship.ts`: Relationship data models
- `src/lib/stores/auth-store.ts`: User session and authentication state

### Design System & UI
- shadcn/ui components: Card, Button, Carousel, Badge
- shadcn Carousel documentation: https://ui.shadcn.com/docs/components/carousel
- Carousel visual reference: shadcn dashboard revenue/metrics cards
- Lucide React icons: https://lucide.dev/

### Utilities
- `src/lib/timezone-utils.ts`: Timezone conversion and formatting
- Luxon DateTime: https://moment.github.io/luxon/

### Installation
- shadcn CLI: `npx shadcn@latest add carousel`
- Embla Carousel (auto-installed): https://www.embla-carousel.com/
