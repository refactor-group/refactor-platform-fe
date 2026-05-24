# Coding Standards

This document outlines coding conventions and standards for this project.

## Branch Workflow (MUST DO FIRST)

**Before making any code changes, create a feature branch off main.** Never work directly on main.

```bash
git checkout -b feat/descriptive-branch-name
```

This is the very first step for every task — no exceptions. If you find yourself about to push to main, **STOP IMMEDIATELY** and ask the user what to do instead.

## Strict Typing and Nullability

Prefer strict, explicit typings and clear nullability rules; don't auto-widen.

- In TypeScript, lean on strict null checks and intentional nullability. Enable `strict: true` and `noImplicitAny`. Use exact types rather than permissive unions, and reserve `null`/`undefined` for truly absent states.

- **Presence/absence — use `Option<T>`**: For values that are either present or absent (mirroring Rust's `Option<T>`), use the project-local `Option<T>` type from `@/types/option`. This provides `Some(val)` and `None` constructors with `.some` / `.none` discriminant checks and `.val` access.

```typescript
// ✅ Correct — use Option<T> for nullable data from the backend
import { type Option, Some, None } from "@/types/option";

interface GoalProgressMetrics {
  last_session_date: Option<string>;
  next_action_due: Option<string>;
}

// Constructing:
const date = value !== null ? Some(value) : None;

// Consuming:
if (metrics.last_session_date.some) {
  console.log(metrics.last_session_date.val); // narrowed to string
}
```

- **Success/failure at async boundaries — use `neverthrow`**: For API calls and other async operations that can fail, use `Result<T, E>` or `ResultAsync<T, E>` from `neverthrow` instead of throwing or returning nullable payloads.

```typescript
// ✅ Correct — Result at the API boundary
import { ResultAsync } from "neverthrow";

const getGoalProgress = (id: Id): ResultAsync<GoalProgressMetrics, ApiError> =>
  ResultAsync.fromPromise(
    EntityApi.getFn<unknown>(`${GOALS_BASEURL}/${id}/progress`).then(parseGoalProgressMetrics),
    (e) => toApiError(e)
  );
```

- **Multi-state UI — use discriminated unions**: For component state machines with more than two states (e.g. loading/loaded/error), use custom discriminated unions:

```typescript
// ✅ Correct — discriminated union for multi-state UI
type FetchState<T> =
  | { kind: "loading" }
  | { kind: "loaded"; value: T }
  | { kind: "error"; message: string };
```

- **When to use which**:
  - `Option<T>` — a value is present or absent (nullable backend fields, optional parameters)
  - `Result<T, E>` / `ResultAsync<T, E>` — an operation succeeds or fails with a typed error
  - Discriminated union — three or more states, or states that carry different payloads

- Accept `string | undefined` from external inputs, but normalize immediately inside functions to `Option<T>`, `Result<T, E>`, or a definitive shape so internals don't propagate raw nullability.

- Write function contracts that eliminate nullability with guards. Parse and validate early, then operate on a non-null `T`.

- Favor exact object shapes over partials. Use `type ExactUser = { id: string; name: string }` instead of `Partial<User>`, and avoid `Record<string, unknown>` unless unavoidable.

- Do not use `T | null | undefined` unless a value is truly optional and none of the above patterns apply. Assume strict null checks. Provide exact types; no lazy unions.

If you inherit nullable APIs, normalize at the edge and keep your core strict. Model absence as a deliberate, named state rather than a catch-all union.

## Exhaustive Switch Statements

When switching on discriminated unions, use both ESLint and the manual `never` pattern for defense in depth. Unlike Rust's `match`, TypeScript's `switch` silently falls through on unhandled cases.

```typescript
switch (action.kind) {
  case ActionKind.Initialize:
    // ...
    break;
  case ActionKind.Error:
    // ...
    break;
  default:
    const _exhaustive: never = action;
    throw new Error(`Unhandled action kind: ${_exhaustive}`);
}
```

The ESLint rule `@typescript-eslint/switch-exhaustiveness-check` catches missing cases at lint time; the `never` pattern catches them at compile time.

## React and TypeScript

### Import Conventions

**React Imports**: Always import specific hooks and types from React rather than using the `React.` prefix.

```typescript
// ✅ Correct
import { useState, useEffect, useCallback } from "react";
import type { FC, ReactNode } from "react";

export const MyComponent: FC = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // effect logic
  }, []);

  return <div>{count}</div>;
};

// ❌ Incorrect
import React from "react";

export const MyComponent: React.FC = () => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    // effect logic
  }, []);

  return <div>{count}</div>;
};
```

**Rationale**:
- Improves code readability by making hook usage more explicit
- Reduces verbosity and visual clutter
- Aligns with modern React conventions and tree-shaking optimization
- Consistent with the rest of the codebase

### Type Annotations

- Use explicit function component typing sparingly - TypeScript can often infer the type
- When needed, import `FC` or `ReactNode` types explicitly from React
- Prefer explicit return types for component props interfaces

```typescript
// ✅ Good - TypeScript infers the component type
export const SimpleComponent = () => {
  return <div>Hello</div>;
};

// ✅ Good - explicit typing when needed for props
import type { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
  title: string;
}

export const ComplexComponent: FC<Props> = ({ children, title }) => {
  return <div>{title}{children}</div>;
};
```

### Nullable Hook Values and Component Props

When a hook returns a nullable value (e.g. `string | null`) and a child component expects a non-nullable prop (e.g. `string`), **never use `|| ""` to silence the type checker**. An empty string is not a valid ID, date, or meaningful value -- it just hides the null from the compiler while passing invalid data downstream.

```typescript
// ❌ WRONG - || "" creates an invalid Id that silently propagates
const { currentCoachingSessionId } = useCurrentCoachingSession(); // string | null
const { currentCoachingRelationship } = useCurrentCoachingRelationship(); // T | null

<MyPanel
  coachingSessionId={currentCoachingSessionId || ""}
  relationshipId={currentCoachingRelationship?.id || ""}
  sessionDate={currentCoachingSession?.date || ""}
/>
```

Instead, **guard the render** so the component only mounts when all required data is available. This lets TypeScript narrow the types naturally without any casts or fallbacks.

```typescript
// ✅ CORRECT - guard the render, pass narrowed non-null values
{currentCoachingSessionId && currentCoachingSession && currentCoachingRelationship && (
  <MyPanel
    coachingSessionId={currentCoachingSessionId}
    relationshipId={currentCoachingRelationship.id}
    sessionDate={currentCoachingSession.date}
  />
)}
```

**Key rules**:
- If a prop is typed as `Id` (i.e. `string`), it must receive a real ID, never `""`.
- If a prop is typed as a date string, it must receive a real date, never `""`.
- The fix is always a **render guard** (conditional rendering), not a **value fallback** (`|| ""`).
- For callback handlers that capture nullable closures, the render guard guarantees they can only be called when data is loaded. Use non-null assertions (`!`) with a comment referencing the guard, or restructure the handler to accept the value as a parameter.

**Why this matters**: `DateTime.fromISO("")` produces an invalid DateTime. `useCoachingSessionList("")` fires a pointless API call. Empty-string IDs silently pass through filters and comparisons, producing wrong results that are hard to debug.

## General Guidelines

### Naming Conventions
- Use PascalCase for component names and files: `ConnectionStatus.tsx`
- Use PascalCase for enum types: `ConnectionState`, `BadgeVariant`
- Use PascalCase for enum values: `ConnectionState.Connecting`, `BadgeVariant.Secondary`
- Use camelCase for functions, variables, and hooks: `useEditorCache`, `handleClick`
- Use SCREAMING_SNAKE_CASE for constants: `MAX_RETRIES`, `API_ENDPOINT`

```typescript
// ✅ Correct - PascalCase for enum types and values
enum ConnectionState {
  Connecting = "connecting",
  Connected = "connected",
  Offline = "offline",
  Error = "error",
}

// ❌ Incorrect - lowercase or SCREAMING_SNAKE_CASE
enum connectionState {
  CONNECTING = "connecting",
  CONNECTED = "connected",
}
```

### File Organization
- Keep React components in `src/components/`
- Place tests in `__tests__/` directories mirroring the source structure
- Group related components in feature-specific subdirectories

### UI Component Libraries

This project uses two UI component libraries with different import paths:

**shadcn/ui components** - Located in `src/components/ui/`
```typescript
// ✅ Correct - shadcn components
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
```

**Kibo UI components** - Located in `src/components/kibo/ui/`
```typescript
// ✅ Correct - Kibo UI components
import { Pill, PillIndicator } from "@/components/kibo/ui/pill";
import { Choicebox, ChoiceboxItem } from "@/components/kibo/ui/choicebox";
```

**Utility function `cn`** - Located in `src/components/lib/utils.ts`
```typescript
// ✅ Correct
import { cn } from "@/components/lib/utils";

// ❌ Incorrect - this path doesn't exist in this project
import { cn } from "@/lib/utils";
```

**Note**: When installing new shadcn components via CLI, you may need to update their imports from `@/lib/utils` to `@/components/lib/utils`.

### Locale and Configuration Prop Threading

Thread configuration values like `locale` through component props rather than importing `siteConfig` directly in leaf components. The top-level container (e.g. a page or tab container) reads from `siteConfig` once and passes the value down.

```typescript
// ✅ Correct - thread locale via props from the top-level container
interface MyCardProps {
  locale: string;
  // ...
}

function MyCard({ locale, ...rest }: MyCardProps) {
  return <DueDatePicker locale={locale} />;
}

// Container component reads from siteConfig once and threads it down
import { siteConfig } from "@/site.config";

function Container() {
  return <MyCard locale={siteConfig.locale} />;
}
```

```typescript
// ❌ Incorrect - importing siteConfig in a leaf/child component
import { siteConfig } from "@/site.config";

function MyCard() {
  return <DueDatePicker locale={siteConfig.locale} />;
}
```

**Do NOT** import `siteConfig` (or other global configuration objects) inside leaf or child components. This creates a hidden global dependency that makes the component harder to test and breaks explicit data flow.

**Rationale**:
- Keeps leaf components pure and testable (no hidden global dependency)
- Makes data flow explicit and traceable
- Follows the same pattern used by `CoachingSessionTitle` and action card components
- Allows tests to supply locale without mocking `siteConfig`

### Comments

Default to no comment. Add one only when the *why* is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug, behavior that would surprise a reader. Never describe *what* the code does; well-named identifiers do that. Don't reference current tasks, PRs, or callers — those rot.

**When you do comment, write the most minimal version that still captures the reason.** Prefer one short line. Trim until removing another word would lose the reason.

```typescript
// ✅ Good — terse, captures the non-obvious reason
// Backend returns naive ISO strings; interpret as UTC before zone conversion.
const dt = DateTime.fromISO(session.date, { zone: "utc" }).setZone(tz);

// ✅ Good — single line, names the invariant
keepPreviousData: true, // avoids a flicker on range expansion.

// ❌ Too verbose — restates what the code does, narrates the design
// Use SWR's `keepPreviousData` option so that when the user clicks
// "Show additional …" and the SWR key changes, the previous data
// is retained while the new request loads, which prevents the
// list from briefly rendering empty buckets that then collapse
// when the response lands.
keepPreviousData: true,

// ❌ No comment needed — the code already says this
// Loop through sessions and check if any are past
const hasPast = sessions.some(isPast);
```

JSDoc on exported APIs is welcome when it documents a contract a caller can't infer from the signature (units, ranges, error conditions). Same brevity rule applies.

## Testing

### No Wall-Clock Time in Time-Sensitive Tests

**Tests must not depend on the real wall clock for any assertion that compares
against calendar boundaries, day-of-week, AM/PM, timezone offsets, or
similar.** A test that passes most of the year but fails at 23:59 local time —
or 04:59 UTC when the user's timezone has just rolled past midnight — is a
broken test, not "flaky CI." It will eventually fail in CI, on a contributor's
laptop in another timezone, or on DST transition days.

**Rules:**

1. **Relative offsets are fine** — `DateTime.now().plus({ minutes: 30 })` for a
   "session 30 minutes from now" is stable, because the assertion only cares
   about the offset, not where on the calendar "now" sits.

2. **Pin the clock whenever the assertion depends on a calendar position** —
   "is this today / tomorrow / yesterday", "is this past end-of-day in
   timezone X", "what day of the week is this", "is this before noon",
   "does this cross a DST boundary". Use `Settings.now` from `ts-luxon`
   (or `vi.useFakeTimers()` + `vi.setSystemTime()`) to make "now" deterministic:

   ```typescript
   import { describe, it, expect, beforeEach, afterEach } from "vitest";
   import { DateTime, Settings } from "ts-luxon";

   describe("day-relative behaviour", () => {
     const originalNow = Settings.now;
     const fakeNow = DateTime.fromISO("2026-03-26T12:00:00.000Z", { zone: "utc" });

     beforeEach(() => {
       Settings.now = () => fakeNow.toMillis();
     });

     afterEach(() => {
       Settings.now = originalNow;
     });

     it("treats a session 24h later as tomorrow", () => {
       // Both createSessionAt and the code under test now see the same
       // fixed "now", so the assertion is stable.
       const session = createSessionAt(24 * 60);
       expect(getUrgencyMessage(session, calculateSessionUrgency(session)))
         .toContain("tomorrow");
     });
   });
   ```

3. **Pin the zone too when timezone-specific behaviour matters.** Either pin
   `Settings.defaultZone`, or build inputs from an explicit ISO string with
   `{ zone: "..." }` rather than relying on the host's system timezone.
   `DateTime.now()` in Node respects `process.env.TZ`, which varies between
   CI and developer machines.

4. **Anti-pattern — defensive fallbacks that hide flakiness.** If a test
   needs a `try/catch`, an `if-else` around `urgency`, or "skip the
   assertion when timing is unlucky" logic, the test is wrong. Pin time
   instead and assert unconditionally.

5. **`DateTime.now()` is OK for opaque metadata** — `created_at`/`updated_at`
   on mock objects that nothing in the assertion compares against can use
   real now without issue.

**Symptom to watch for:** a test creates data with `DateTime.now()`,
then calls a function that *also* reads `DateTime.now()`, then asserts on
calendar-day semantics. The two `now`s can land on different calendar days
(or sides of a DST boundary) — the test passes 99% of the time and fails
in CI exactly once a year per timezone.

## Code Review Checklist

When reviewing or writing code, ensure:
- [ ] React hooks are imported directly, not accessed via `React.`
- [ ] Components follow the established import patterns
- [ ] Enum types and values use PascalCase
- [ ] Comments are terse and explain *why*, not *what* — default to none
- [ ] Tests are updated to match code changes
- [ ] TypeScript types are properly defined and used
- [ ] Leaf components receive `locale` and config values via props, not `siteConfig` imports
- [ ] No `|| ""` fallbacks for nullable IDs or dates -- use render guards instead
- [ ] Tests with calendar-boundary assertions pin `Settings.now` instead of relying on real time
