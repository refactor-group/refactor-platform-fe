# API Specification: Today's Sessions Endpoint

**Version:** 1.0
**Date:** 2025-10-23
**Author:** System Architecture Team
**Status:** Proposed

## Overview

This document specifies a new backend API endpoint designed to efficiently fetch all of a user's coaching sessions scheduled for "today" across all their coaching relationships, including associated overarching goals, relationship details, and organization information.

### Problem Statement

The current frontend implementation requires multiple API calls to display today's sessions:
1. Fetch user's organizations
2. For each organization, fetch coaching relationships
3. For each relationship, fetch sessions in date range
4. For each session, fetch overarching goal

This results in an N+1 query problem and dozens of API round trips, causing:
- Performance degradation
- Complex client-side state management
- Infinite loop vulnerabilities from unstable array references
- Poor user experience with loading states

### Solution

A single, optimized backend endpoint that returns all necessary data in one request.

---

## Endpoint Definition

### HTTP Method and Path

```
GET /api/v1/users/{userId}/todays-sessions
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | UUID | Yes | The ID of the user requesting their sessions |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `timezone` | String | No | User's profile timezone or UTC | IANA timezone identifier (e.g., "America/Los_Angeles", "Europe/London") |
| `include_past` | Boolean | No | `false` | Whether to include sessions that have already ended today |

### Request Headers

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### Authentication & Authorization

- **Authentication:** Required. User must be authenticated via JWT.
- **Authorization:** User can only access their own sessions (`userId` in path must match authenticated user's ID).
- **Error Response:** `403 Forbidden` if user attempts to access another user's sessions.

---

## Response Format

### Success Response (200 OK)

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "date": "2025-10-23",
  "timezone": "America/Los_Angeles",
  "sessions": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "date": "2025-10-23T14:00:00Z",
      "coaching_relationship_id": "750e8400-e29b-41d4-a716-446655440002",
      "overarching_goal": {
        "id": "850e8400-e29b-41d4-a716-446655440003",
        "title": "Improve leadership communication skills",
        "description": "Develop clearer communication strategies for team management"
      },
      "relationship": {
        "id": "750e8400-e29b-41d4-a716-446655440002",
        "coach_id": "950e8400-e29b-41d4-a716-446655440004",
        "coach_first_name": "Sarah",
        "coach_last_name": "Johnson",
        "coachee_id": "550e8400-e29b-41d4-a716-446655440000",
        "coachee_first_name": "John",
        "coachee_last_name": "Smith",
        "organization_id": "a50e8400-e29b-41d4-a716-446655440005"
      },
      "organization": {
        "id": "a50e8400-e29b-41d4-a716-446655440005",
        "name": "Refactor Group"
      }
    },
    {
      "id": "650e8400-e29b-41d4-a716-446655440006",
      "date": "2025-10-23T16:30:00Z",
      "coaching_relationship_id": "750e8400-e29b-41d4-a716-446655440007",
      "overarching_goal": null,
      "relationship": {
        "id": "750e8400-e29b-41d4-a716-446655440007",
        "coach_id": "550e8400-e29b-41d4-a716-446655440000",
        "coach_first_name": "John",
        "coach_last_name": "Smith",
        "coachee_id": "950e8400-e29b-41d4-a716-446655440008",
        "coachee_first_name": "Emily",
        "coachee_last_name": "Davis",
        "organization_id": "a50e8400-e29b-41d4-a716-446655440009"
      },
      "organization": {
        "id": "a50e8400-e29b-41d4-a716-446655440009",
        "name": "Tech Innovations Inc"
      }
    }
  ],
  "total_count": 2
}
```

### Response Fields

#### Root Level

| Field | Type | Description |
|-------|------|-------------|
| `user_id` | UUID | The user ID for whom sessions were fetched |
| `date` | String (ISO 8601 Date) | The date for which sessions are returned (in user's timezone) |
| `timezone` | String | The timezone used to determine "today" |
| `sessions` | Array | Array of session objects (see below) |
| `total_count` | Integer | Total number of sessions returned |

#### Session Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | UUID | No | Session unique identifier |
| `date` | String (ISO 8601 DateTime) | No | Session date/time in UTC |
| `coaching_relationship_id` | UUID | No | ID of the associated coaching relationship |
| `overarching_goal` | Object | Yes | Associated overarching goal (null if none) |
| `relationship` | Object | No | Coaching relationship details |
| `organization` | Object | No | Organization details |

#### Overarching Goal Object (nullable)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Goal unique identifier |
| `title` | String | Goal title/summary |
| `description` | String | Detailed goal description |

#### Relationship Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Relationship unique identifier |
| `coach_id` | UUID | Coach user ID |
| `coach_first_name` | String | Coach first name |
| `coach_last_name` | String | Coach last name |
| `coachee_id` | UUID | Coachee user ID |
| `coachee_first_name` | String | Coachee first name |
| `coachee_last_name` | String | Coachee last name |
| `organization_id` | UUID | Organization ID |

#### Organization Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Organization unique identifier |
| `name` | String | Organization name |

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

#### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access sessions for this user"
}
```

#### 400 Bad Request
```json
{
  "error": "Bad Request",
  "message": "Invalid timezone identifier",
  "details": {
    "field": "timezone",
    "provided": "Invalid/Timezone",
    "valid_example": "America/Los_Angeles"
  }
}
```

#### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "User not found"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Business Logic

### "Today" Definition

The endpoint determines "today" based on the following logic:

1. **Timezone Resolution:**
   - Use `timezone` query parameter if provided
   - Else, use user's profile timezone setting
   - Else, default to UTC

2. **Date Range Calculation:**
   ```
   startOfDay = today at 00:00:00 in user's timezone, converted to UTC
   endOfDay = today at 23:59:59.999 in user's timezone, converted to UTC
   ```

3. **Session Filtering:**
   - Include sessions where `session.date >= startOfDay AND session.date <= endOfDay`
   - Apply timezone conversion to ensure accurate filtering

### Relationship Inclusion

Include sessions from all coaching relationships where:
- User is either coach OR coachee
- Relationship is active (not archived/deleted)
- Session falls within today's date range

### Overarching Goal Association

- Each session can have 0 or 1 associated overarching goal
- If no goal exists, `overarching_goal` field is `null`
- If multiple goals exist (edge case), return the most recently created goal

### Sorting

Sessions are sorted chronologically by `date` (ascending) - earliest session first.

---

## Implementation Considerations

### Database Query Optimization

Recommended SQL approach (pseudo-code):

```sql
-- Single query with LEFT JOINs to avoid N+1 queries
SELECT
  cs.id,
  cs.date,
  cs.coaching_relationship_id,
  og.id as goal_id,
  og.title as goal_title,
  og.description as goal_description,
  cr.id as relationship_id,
  cr.coach_id,
  coach.first_name as coach_first_name,
  coach.last_name as coach_last_name,
  cr.coachee_id,
  coachee.first_name as coachee_first_name,
  coachee.last_name as coachee_last_name,
  cr.organization_id,
  org.name as organization_name
FROM coaching_sessions cs
INNER JOIN coaching_relationships cr
  ON cs.coaching_relationship_id = cr.id
INNER JOIN users coach ON cr.coach_id = coach.id
INNER JOIN users coachee ON cr.coachee_id = coachee.id
INNER JOIN organizations org ON cr.organization_id = org.id
LEFT JOIN overarching_goals og
  ON cs.id = og.coaching_session_id
WHERE
  (cr.coach_id = :userId OR cr.coachee_id = :userId)
  AND cs.date >= :startOfDay
  AND cs.date <= :endOfDay
  AND cr.deleted_at IS NULL
ORDER BY cs.date ASC
```

### Caching Strategy

Consider caching this endpoint response with:
- **Cache Key:** `user:{userId}:todays-sessions:{date}:{timezone}`
- **TTL:** 5-15 minutes (sessions don't change frequently)
- **Invalidation:** Clear cache when:
  - User creates/updates/deletes a session
  - User creates/updates/deletes an overarching goal
  - Date changes (midnight in user's timezone)

### Performance Targets

- **Response Time:** < 200ms (p95)
- **Database Query:** Single query with JOINs (no N+1)
- **Typical Payload Size:** < 10KB (assuming ~5 sessions per user per day)

### Index Recommendations

```sql
-- Composite index for efficient date range + user filtering
CREATE INDEX idx_sessions_date_relationship
  ON coaching_sessions(date, coaching_relationship_id);

-- Index for relationship user lookups
CREATE INDEX idx_relationships_users
  ON coaching_relationships(coach_id, coachee_id)
  WHERE deleted_at IS NULL;

-- Index for goal lookups
CREATE INDEX idx_goals_session
  ON overarching_goals(coaching_session_id);
```

---

## Example Usage

### Request Example 1: Basic Request

```bash
curl -X GET \
  'https://api.refactorcoaching.com/api/v1/users/550e8400-e29b-41d4-a716-446655440000/todays-sessions' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

### Request Example 2: With Timezone

```bash
curl -X GET \
  'https://api.refactorcoaching.com/api/v1/users/550e8400-e29b-41d4-a716-446655440000/todays-sessions?timezone=America/New_York' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

### Request Example 3: Include Past Sessions

```bash
curl -X GET \
  'https://api.refactorcoaching.com/api/v1/users/550e8400-e29b-41d4-a716-446655440000/todays-sessions?include_past=true' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

---

## Frontend Integration

### Proposed Hook Implementation

Once this endpoint is available, the frontend can be simplified to:

```typescript
// src/lib/api/todays-sessions.ts
export interface TodaysSessionsResponse {
  user_id: string;
  date: string;
  timezone: string;
  sessions: Array<{
    id: string;
    date: string;
    coaching_relationship_id: string;
    overarching_goal: {
      id: string;
      title: string;
      description: string;
    } | null;
    relationship: {
      id: string;
      coach_id: string;
      coach_first_name: string;
      coach_last_name: string;
      coachee_id: string;
      coachee_first_name: string;
      coachee_last_name: string;
      organization_id: string;
    };
    organization: {
      id: string;
      name: string;
    };
  }>;
  total_count: number;
}

export const TodaysSessionsApi = {
  get: async (userId: string, timezone?: string): Promise<TodaysSessionsResponse> => {
    const params = new URLSearchParams();
    if (timezone) params.append('timezone', timezone);

    const response = await fetch(
      `${API_BASE_URL}/users/${userId}/todays-sessions?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch today's sessions: ${response.statusText}`);
    }

    return response.json();
  },
};

// Hook
export function useTodaysSessions() {
  const { userSession } = useAuthStore();
  const userId = userSession?.id;
  const timezone = userSession?.timezone || getBrowserTimezone();

  const { data, error, isLoading, mutate } = useSWR(
    userId ? ['todays-sessions', userId, timezone] : null,
    () => TodaysSessionsApi.get(userId!, timezone),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  return {
    sessions: data?.sessions || [],
    isLoading,
    error,
    refresh: mutate,
  };
}
```

### Benefits of New Hook

1. **Single API Call:** Replaces dozens of calls with one
2. **No Client-Side Joins:** All data pre-joined by backend
3. **No N+1 Queries:** Goals included in initial response
4. **Stable References:** Single array from single source
5. **Simpler State:** No complex Maps/Sets for tracking loaded data
6. **Timezone Accuracy:** Backend handles timezone logic correctly

---

## Migration Path

### Phase 1: Backend Implementation
1. Implement new endpoint with comprehensive tests
2. Deploy to staging environment
3. Validate performance and correctness

### Phase 2: Frontend Preparation
1. Create new `useTodaysSessions` hook using new endpoint
2. Keep old implementation as fallback
3. Feature flag to toggle between old/new implementation

### Phase 3: Gradual Rollout
1. Enable for internal users (beta testing)
2. Monitor performance metrics and error rates
3. Gradually increase rollout percentage
4. Full rollout once validated

### Phase 4: Cleanup
1. Remove old implementation after 30 days
2. Delete obsolete hooks and utilities
3. Update documentation

---

## Testing Requirements

### Unit Tests

- Timezone edge cases (date boundaries, DST transitions)
- Null handling for optional fields (overarching goals)
- User authorization (coach vs coachee access)
- Date range filtering accuracy

### Integration Tests

- Multiple organizations and relationships
- Sessions spanning midnight in user's timezone
- Cache invalidation scenarios
- Performance under load (100+ concurrent requests)

### Test Cases

1. **User with no sessions today** → Returns empty array
2. **User in PST timezone at 11:30 PM PST** → Only includes sessions before midnight PST
3. **User as both coach and coachee** → Includes sessions from both roles
4. **Session with no overarching goal** → `overarching_goal` is null
5. **Invalid timezone parameter** → Returns 400 Bad Request
6. **Unauthorized access** → Returns 403 Forbidden
7. **User from different timezone** → Correctly filters based on their timezone

---

## Security Considerations

1. **Authorization:** Enforce user can only access their own sessions
2. **Data Exposure:** Only expose necessary fields (no sensitive internal data)
3. **Rate Limiting:** Apply standard API rate limits (suggested: 100 requests/minute per user)
4. **Input Validation:** Validate timezone parameter against IANA timezone database
5. **SQL Injection:** Use parameterized queries for all database access

---

## Monitoring & Observability

### Metrics to Track

- Request latency (p50, p95, p99)
- Error rate by status code
- Cache hit/miss ratio
- Database query execution time
- Number of sessions returned per request

### Alerts

- Error rate > 1% for 5 minutes → Page on-call engineer
- p95 latency > 500ms for 5 minutes → Warning notification
- Database query time > 1 second → Warning notification

### Logging

Log the following for each request:
- User ID
- Timezone used
- Number of sessions returned
- Query execution time
- Any errors encountered

---

## Future Enhancements

Potential future improvements to consider:

1. **Date Range Parameter:** Allow fetching sessions for arbitrary date ranges
   ```
   GET /users/{userId}/sessions?from_date={date}&to_date={date}
   ```

2. **Pagination:** For users with many sessions per day
   ```
   GET /users/{userId}/todays-sessions?page=1&per_page=10
   ```

3. **Filtering:** Filter by organization, relationship, or goal status
   ```
   GET /users/{userId}/todays-sessions?organization_id={id}
   ```

4. **Sorting Options:** Allow custom sorting (by date, organization, etc.)
   ```
   GET /users/{userId}/todays-sessions?sort_by=organization&sort_order=asc
   ```

5. **Field Selection:** Allow clients to request specific fields only
   ```
   GET /users/{userId}/todays-sessions?fields=id,date,overarching_goal.title
   ```

---

## Questions for Backend Team

1. **Current Session Model:** Does the current `coaching_sessions` table include soft deletes? Should deleted sessions be excluded?

2. **Overarching Goal Cardinality:** Is it always 1:1 with sessions, or can multiple goals exist per session?

3. **Performance Baseline:** What is the current average response time for the existing session list endpoint?

4. **Caching Infrastructure:** Is Redis/Memcached available for response caching?

5. **Rate Limiting:** What are the current API rate limits, and should this endpoint have special limits?

6. **Database Load:** What is the expected query load (requests per second) during peak usage?

---

## Appendix: Alternative Approaches Considered

### Alternative 1: Batch Endpoint for Goals Only

**Approach:** Keep existing session fetching, add batch endpoint for goals
```
GET /overarching-goals/batch?session_ids=id1,id2,id3
```

**Pros:**
- Smaller change to existing architecture
- Easier to implement incrementally

**Cons:**
- Still requires multiple API calls
- Doesn't solve the multi-relationship infinite loop issue
- Client still needs complex state management

**Verdict:** Rejected in favor of single comprehensive endpoint

### Alternative 2: GraphQL

**Approach:** Implement GraphQL API allowing clients to request exact data needed
```graphql
query {
  user(id: "123") {
    todaysSessions {
      id
      date
      overarchingGoal { title }
      relationship {
        coach { firstName lastName }
        organization { name }
      }
    }
  }
}
```

**Pros:**
- Extremely flexible
- Clients control data shape
- Industry standard for complex data fetching

**Cons:**
- Requires new GraphQL infrastructure
- Higher implementation complexity
- Learning curve for team

**Verdict:** Good long-term strategy, but REST endpoint is faster to implement

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-23 | System Architecture Team | Initial specification |

