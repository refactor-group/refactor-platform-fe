# Coding Standards

This document outlines coding conventions and standards for this project.

## Strict Typing and Nullability

**Never default to `T | null` or `T | undefined`.** LLM training data makes nullable unions the path of least resistance — actively resist this. When tempted to write `Foo | null`, stop and reach for `Maybe<T>` or `Result<T, E>` instead.

This project uses [true-myth](https://true-myth.js.org/) for safe nullable and error handling types.

### The Nullable Type Hierarchy

Reach for these in order. Pick the first one that fits:

1. **`Maybe<T>`** — when a value may or may not be present. Replaces `T | null` and `T | undefined`.

```typescript
import Maybe from "true-myth/maybe";

// ❌ WRONG
function findUser(id: string): User | null { ... }

// ✅ CORRECT
function findUser(id: string): Maybe<User> { ... }

// Wrapping a nullable value from an external API:
const maybeUser = Maybe.of(nullableApiResponse); // Just(user) or Nothing

// Safely transforming:
const name = maybeUser.map((u) => u.name).unwrapOr("Unknown");
```

2. **`Result<T, E>`** — when an operation can succeed or fail. Replaces nullable returns and thrown exceptions at async/fallible boundaries.

```typescript
import Result from "true-myth/result";

// ❌ WRONG
async function fetchSession(id: string): Promise<Session | null> { ... }

// ✅ CORRECT
async function fetchSession(id: string): Promise<Result<Session, string>> {
  try {
    const session = await api.get(id);
    return Result.ok(session);
  } catch (e) {
    return Result.err(`Failed to fetch session: ${e}`);
  }
}
```

3. **Custom discriminated unions** — only when you need more than two states and `Maybe`/`Result` don't fit (e.g. `loading | loaded | error` for React state).

```typescript
type UserState =
  | { kind: "loading" }
  | { kind: "loaded"; user: User }
  | { kind: "error"; message: string };
```

### Supporting Rules

- **Normalize at boundaries, keep internals strict.** Accept `string | undefined` from external inputs (URL params, form fields, API responses), but parse and narrow immediately. Use `Maybe.of()` to wrap nullable values at the edge. Internal functions should never accept or return bare nullable types.

```typescript
// ✅ Boundary function wraps nullable input immediately
import Maybe from "true-myth/maybe";

function parseSessionDate(raw: string | undefined): Maybe<DateTime> {
  return Maybe.of(raw)
    .map((r) => DateTime.fromISO(r))
    .andThen((dt) => (dt.isValid ? Maybe.just(dt) : Maybe.nothing()));
}
```

- **Exact object shapes over partials.** Use `type ExactUser = { id: string; name: string }` instead of `Partial<User>`. Avoid `Record<string, unknown>` unless unavoidable.

- **No `T | null | undefined` double-nullable.** If a value can be absent, use `Maybe<T>` — never combine both `null` and `undefined`.

### When Bare `null` Is Acceptable

Reserve bare `null` for cases where it is forced by external APIs or React conventions:
- A React ref before mount (`useRef<HTMLElement>(null)`)
- A third-party library that requires `null` in its API contract
- Zustand/Redux state where `null` is the established convention for "not yet loaded" and migrating to `Maybe` would touch too many files at once

For domain types, always prefer `Maybe<T>` over `T | null`. If you inherit nullable APIs from external libraries or backend responses, wrap with `Maybe.of()` at the edge and keep your core strict.

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

### Documentation
- Add JSDoc comments for complex logic or non-obvious patterns
- Explain *why* something is done, not just *what* is being done
- Document external state synchronization patterns (like forceUpdate mechanisms)

## Code Review Checklist

When reviewing or writing code, ensure:
- [ ] React hooks are imported directly, not accessed via `React.`
- [ ] Components follow the established import patterns
- [ ] Enum types and values use PascalCase
- [ ] Complex logic has explanatory comments
- [ ] Tests are updated to match code changes
- [ ] TypeScript types are properly defined and used
- [ ] Leaf components receive `locale` and config values via props, not `siteConfig` imports
- [ ] No `|| ""` fallbacks for nullable IDs or dates -- use render guards instead
- [ ] New types use `Maybe<T>` or `Result<T, E>` from `true-myth` instead of `T | null`
